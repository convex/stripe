import { afterEach, describe, expect, test, vi } from "vitest";
import StripeSDK from "stripe";
import type { HttpRouter } from "convex/server";
import { registerRoutes, type RegisterRoutesConfig } from "./index.js";
import { components } from "./setup.test.js";

const WEBHOOK_SECRET = "whsec_test_secret";

const customerCreatedEvent = {
  id: "evt_customer_created",
  object: "event",
  type: "customer.created",
  created: 1_800_000_000,
  data: {
    object: {
      id: "cus_webhook",
      object: "customer",
      email: "webhook@example.com",
      name: "Webhook Customer",
      metadata: { userId: "user_webhook" },
    },
  },
};

function getWebhookRoute(config: RegisterRoutesConfig = {}) {
  const route = vi.fn();
  registerRoutes({ route } as unknown as HttpRouter, components.stripe, {
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    STRIPE_SECRET_KEY: "sk_test_unused",
    ...config,
  });
  const { path, method, handler } = route.mock.calls[0][0];
  return {
    path,
    method,
    handler: handler._handler as (
      ctx: unknown,
      request: Request,
    ) => Promise<Response>,
  };
}

async function signedRequest(
  event: object,
  options: { secret?: string; signed?: boolean } = {},
) {
  const payload = JSON.stringify(event);
  const headers: Record<string, string> = {};
  if (options.signed !== false) {
    headers["stripe-signature"] = await new StripeSDK(
      "sk_test_unused",
    ).webhooks.generateTestHeaderStringAsync({
      payload,
      secret: options.secret ?? WEBHOOK_SECRET,
    });
  }
  return new Request("https://example.convex.site/stripe/webhook", {
    method: "POST",
    headers,
    body: payload,
  });
}

function webhookCtx(
  options: { claim?: "claimed" | "processed" | "in_progress" } = {},
) {
  const steps: string[] = [];
  let claimed = false;
  const ctx = {
    runQuery: vi.fn(),
    runMutation: vi.fn(async (_ref: unknown, args: object) => {
      if (!("stripeEventId" in args)) {
        steps.push("sync customer");
        return null;
      }
      if (!claimed) {
        claimed = true;
        steps.push("claim event");
        return options.claim ?? "claimed";
      }
      steps.push("type" in args ? "record event" : "release event");
      return null;
    }),
  };
  return { ctx, steps };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("webhook route", () => {
  test("registers a POST route at /stripe/webhook by default", () => {
    const { path, method } = getWebhookRoute();
    expect(path).toBe("/stripe/webhook");
    expect(method).toBe("POST");
  });

  test("syncs a signed event, runs handlers in order, then records it", async () => {
    const { ctx, steps } = webhookCtx();
    const { handler } = getWebhookRoute({
      onEvent: async () => {
        steps.push("onEvent");
      },
      events: {
        "customer.created": async () => {
          steps.push("customer.created handler");
        },
      },
    });

    const response = await handler(
      ctx,
      await signedRequest(customerCreatedEvent),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(steps).toEqual([
      "claim event",
      "sync customer",
      "onEvent",
      "customer.created handler",
      "record event",
    ]);
    expect(ctx.runMutation.mock.calls[1][1]).toMatchObject({
      stripeCustomerId: "cus_webhook",
      email: "webhook@example.com",
      eventCreated: 1_800_000_000,
    });
    expect(ctx.runMutation.mock.calls[2][1]).toEqual({
      stripeEventId: "evt_customer_created",
      type: "customer.created",
      created: 1_800_000_000,
    });
  });

  test("acknowledges an already processed event without running anything, and logs the skip", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { ctx, steps } = webhookCtx({ claim: "processed" });
    const onEvent = vi.fn();
    const { handler } = getWebhookRoute({ onEvent });

    const response = await handler(
      ctx,
      await signedRequest(customerCreatedEvent),
    );

    expect(response.status).toBe(200);
    expect(steps).toEqual(["claim event"]);
    expect(onEvent).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "⏭️ Skipping webhook event evt_customer_created (customer.created) - already processed",
    );
  });

  test("with deduplicateEvents off, handles an already processed event again and records nothing", async () => {
    const { ctx, steps } = webhookCtx({ claim: "processed" });
    const { handler } = getWebhookRoute({
      deduplicateEvents: false,
      onEvent: async () => {
        steps.push("onEvent");
      },
    });

    const response = await handler(
      ctx,
      await signedRequest(customerCreatedEvent),
    );

    expect(response.status).toBe(200);
    expect(steps).toEqual(["sync customer", "onEvent"]);
  });

  test("answers 409 without running anything while another delivery of the event is in progress", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { ctx, steps } = webhookCtx({ claim: "in_progress" });
    const onEvent = vi.fn();
    const { handler } = getWebhookRoute({ onEvent });

    const response = await handler(
      ctx,
      await signedRequest(customerCreatedEvent),
    );

    expect(response.status).toBe(409);
    expect(steps).toEqual(["claim event"]);
    expect(onEvent).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "⏳ Webhook event evt_customer_created (customer.created) is already being processed",
    );
  });

  test("releases the event when a handler fails, so Stripe's retry runs it again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { ctx, steps } = webhookCtx();
    const { handler } = getWebhookRoute({
      events: {
        "customer.created": async () => {
          throw new Error("downstream failure");
        },
      },
    });

    const response = await handler(
      ctx,
      await signedRequest(customerCreatedEvent),
    );

    expect(response.status).toBe(500);
    expect(steps).toEqual(["claim event", "sync customer", "release event"]);
    expect(ctx.runMutation.mock.calls[2][1]).toEqual({
      stripeEventId: "evt_customer_created",
    });
  });

  test("rejects a request signed with a different secret", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { ctx } = webhookCtx();
    const { handler } = getWebhookRoute();

    const response = await handler(
      ctx,
      await signedRequest(customerCreatedEvent, { secret: "whsec_attacker" }),
    );

    expect(response.status).toBe(400);
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  test("rejects a request without a signature", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { ctx } = webhookCtx();
    const { handler } = getWebhookRoute();

    const response = await handler(
      ctx,
      await signedRequest(customerCreatedEvent, { signed: false }),
    );

    expect(response.status).toBe(400);
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  test("returns 500 when the webhook secret is not configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const { ctx } = webhookCtx();
    const { handler } = getWebhookRoute({ STRIPE_WEBHOOK_SECRET: undefined });

    const response = await handler(
      ctx,
      await signedRequest(customerCreatedEvent),
    );

    vi.unstubAllEnvs();
    expect(response.status).toBe(500);
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });
});
