import { describe, expect, test, vi } from "vitest";
import StripeSDK from "stripe";
import type { HttpRouter } from "convex/server";
import * as clientModule from "./index.js";
import {
  StripeSubscriptions,
  registerRoutes,
  type RegisterRoutesConfig,
} from "./index.js";
import { components } from "./setup.test.js";

const stripeMocks = vi.hoisted(() => ({
  retrieveSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  updateSubscriptionItem: vi.fn(),
  createCheckoutSession: vi.fn(),
  constructEvent: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: Object.assign(
    vi.fn().mockImplementation(function StripeMock() {
      return {
        webhooks: {
          constructEventAsync: stripeMocks.constructEvent,
        },
        customers: {
          create: stripeMocks.createCustomer,
          update: stripeMocks.updateCustomer,
        },
        subscriptions: {
          retrieve: stripeMocks.retrieveSubscription,
          update: stripeMocks.updateSubscription,
          cancel: stripeMocks.cancelSubscription,
        },
        subscriptionItems: {
          update: stripeMocks.updateSubscriptionItem,
        },
        checkout: {
          sessions: {
            create: stripeMocks.createCheckoutSession,
          },
        },
      };
    }),
    { API_VERSION: "2026-10-28.endive" },
  ),
}));

describe("StripeSubscriptions client", () => {
  test("should create Stripe client with component", async () => {
    const client = new StripeSubscriptions(components.stripe);
    expect(client).toBeDefined();
    expect(client.component).toBeDefined();
  });

  test("should accept STRIPE_SECRET_KEY option", async () => {
    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });
    expect(client).toBeDefined();
    // The apiKey getter should return the provided key
    expect(client.apiKey).toBe("sk_test_123");
  });

  test("should pass Stripe client configuration options to the SDK", async () => {
    vi.mocked(StripeSDK).mockClear();
    stripeMocks.createCheckoutSession.mockResolvedValue({
      id: "cs_config",
      url: "https://checkout.stripe.com/c/pay/cs_config",
    });

    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
      apiVersion: "2026-04-22.dahlia",
    });

    await client.createCheckoutSession(
      {
        runAction: vi.fn(),
        runMutation: vi.fn(),
        runQuery: vi.fn(),
      },
      {
        priceId: "price_123",
        mode: "payment",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      },
    );

    expect(StripeSDK).toHaveBeenCalledWith("sk_test_123", {
      apiVersion: "2026-04-22.dahlia",
    });
  });

  test("should throw error when accessing apiKey without key set", async () => {
    // Clear the environment variable temporarily
    const originalKey = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;

    const client = new StripeSubscriptions(components.stripe);

    expect(() => client.apiKey).toThrow(
      "STRIPE_SECRET_KEY environment variable is not set",
    );

    // Restore the environment variable
    if (originalKey) {
      process.env.STRIPE_SECRET_KEY = originalKey;
    }
  });

  test("should update Stripe then sync quantity via internal mutation", async () => {
    stripeMocks.retrieveSubscription.mockResolvedValue({
      items: { data: [{ id: "si_test_123" }] },
    });
    stripeMocks.updateSubscriptionItem.mockResolvedValue({});

    const ctx = {
      runAction: vi.fn(),
      runMutation: vi.fn().mockResolvedValue(null),
      runQuery: vi.fn(),
    };
    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    await client.updateSubscriptionQuantity(ctx, {
      stripeSubscriptionId: "sub_test_123",
      quantity: 7,
    });

    expect(stripeMocks.retrieveSubscription).toHaveBeenCalledWith(
      "sub_test_123",
    );
    expect(stripeMocks.updateSubscriptionItem).toHaveBeenCalledWith(
      "si_test_123",
      { quantity: 7 },
    );
    expect(ctx.runMutation).toHaveBeenCalledWith(
      components.stripe.private.updateSubscriptionQuantityInternal,
      {
        stripeSubscriptionId: "sub_test_123",
        quantity: 7,
      },
    );
    expect(ctx.runAction).not.toHaveBeenCalled();
  });

  test("cancelSubscription includes customer ID when syncing subscription", async () => {
    stripeMocks.updateSubscription.mockResolvedValue({
      id: "sub_cancel",
      customer: "cus_cancel",
      status: "active",
      cancel_at_period_end: true,
      cancel_at: 1_800_000_000,
      metadata: { userId: "user_cancel" },
      items: {
        data: [
          {
            current_period_end: 1_800_000_000,
            quantity: 3,
            price: { id: "price_cancel" },
          },
        ],
      },
    });

    const ctx = {
      runAction: vi.fn(),
      runMutation: vi.fn().mockResolvedValue(null),
      runQuery: vi.fn(),
    };
    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    await client.cancelSubscription(ctx, {
      stripeSubscriptionId: "sub_cancel",
      cancelAtPeriodEnd: true,
    });

    expect(ctx.runMutation).toHaveBeenCalledWith(
      components.stripe.private.handleSubscriptionUpdated,
      expect.any(Object),
    );
    expect(ctx.runMutation.mock.calls[0][1]).toMatchObject({
      stripeSubscriptionId: "sub_cancel",
      stripeCustomerId: "cus_cancel",
      priceId: "price_cancel",
    });
  });

  test("reactivateSubscription includes customer ID when syncing subscription", async () => {
    stripeMocks.updateSubscription.mockResolvedValue({
      id: "sub_reactivate",
      customer: "cus_reactivate",
      status: "active",
      cancel_at_period_end: false,
      cancel_at: null,
      metadata: { userId: "user_reactivate" },
      items: {
        data: [
          {
            current_period_end: 1_800_000_000,
            quantity: 2,
            price: { id: "price_reactivate" },
          },
        ],
      },
    });

    const ctx = {
      runAction: vi.fn(),
      runMutation: vi.fn().mockResolvedValue(null),
      runQuery: vi.fn(),
    };
    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    await client.reactivateSubscription(ctx, {
      stripeSubscriptionId: "sub_reactivate",
    });

    expect(ctx.runMutation).toHaveBeenCalledWith(
      components.stripe.private.handleSubscriptionUpdated,
      expect.any(Object),
    );
    expect(ctx.runMutation.mock.calls[0][1]).toMatchObject({
      stripeSubscriptionId: "sub_reactivate",
      stripeCustomerId: "cus_reactivate",
      priceId: "price_reactivate",
    });
  });

  test("updateSubscriptionMetadata writes to Stripe, then syncs the result", async () => {
    stripeMocks.updateSubscription.mockResolvedValueOnce({
      id: "sub_meta",
      customer: "cus_meta",
      status: "active",
      cancel_at_period_end: false,
      cancel_at: null,
      metadata: { userId: "user_meta", orgId: "org_meta", seats: "5" },
      items: {
        data: [
          {
            current_period_end: 1_800_000_000,
            quantity: 5,
            price: { id: "price_meta" },
          },
        ],
      },
    });
    const ctx = {
      runAction: vi.fn(),
      runMutation: vi.fn().mockResolvedValue(null),
      runQuery: vi.fn(),
    };
    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    await client.updateSubscriptionMetadata(ctx, {
      stripeSubscriptionId: "sub_meta",
      metadata: { orgId: "org_meta", seats: "5" },
    });

    expect(stripeMocks.updateSubscription).toHaveBeenCalledWith("sub_meta", {
      metadata: { orgId: "org_meta", seats: "5" },
    });
    expect(ctx.runMutation).toHaveBeenCalledWith(
      components.stripe.private.handleSubscriptionUpdated,
      expect.objectContaining({
        stripeSubscriptionId: "sub_meta",
        metadata: { userId: "user_meta", orgId: "org_meta", seats: "5" },
      }),
    );
  });

  // What the component returns when a user has no customer, subscriptions,
  // or payments, followed by `getCustomer` results for each created customer.
  function newUserCtx(createdCustomers: unknown[]) {
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    for (const customer of createdCustomers) {
      runQuery.mockResolvedValueOnce(customer);
    }
    return {
      runAction: vi.fn(),
      runMutation: vi.fn().mockResolvedValue("cus_ignored"),
      runQuery,
    };
  }

  test("getOrCreateCustomer replaces a deleted customer that Stripe replays for the idempotency key", async () => {
    stripeMocks.createCustomer.mockReset();
    stripeMocks.createCustomer
      .mockResolvedValueOnce({ id: "cus_deleted_today" })
      .mockResolvedValueOnce({ id: "cus_replacement" });
    const ctx = newUserCtx([
      { stripeCustomerId: "cus_deleted_today", deleted: true },
      { stripeCustomerId: "cus_replacement" },
    ]);
    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    const result = await client.getOrCreateCustomer(ctx, {
      userId: "user_replayed",
    });

    expect(result).toEqual({ customerId: "cus_replacement", isNew: true });
    expect(
      stripeMocks.createCustomer.mock.calls.map(([, options]) => options),
    ).toEqual([
      { idempotencyKey: "create_customer_user_replayed" },
      {
        idempotencyKey: "create_customer_user_replayed_after_cus_deleted_today",
      },
    ]);
  });

  test("getOrCreateCustomer gives up when every customer Stripe returns is deleted", async () => {
    stripeMocks.createCustomer.mockReset();
    stripeMocks.createCustomer.mockResolvedValue({ id: "cus_always_deleted" });
    const deleted = { stripeCustomerId: "cus_always_deleted", deleted: true };
    const ctx = newUserCtx([deleted, deleted, deleted, deleted, deleted]);
    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    await expect(
      client.getOrCreateCustomer(ctx, { userId: "user_stuck" }),
    ).rejects.toThrow("have since been deleted");
    expect(stripeMocks.createCustomer).toHaveBeenCalledTimes(5);
    stripeMocks.createCustomer.mockReset();
  });

  function getOrCreateCustomerCtx(lookups: {
    byUserId?: unknown;
    subscriptions?: unknown[];
    payments?: unknown[];
    linkedCustomers?: unknown[];
    byEmail?: unknown;
  }) {
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce(lookups.byUserId ?? null)
      .mockResolvedValueOnce(lookups.subscriptions ?? [])
      .mockResolvedValueOnce(lookups.payments ?? []);
    for (const customer of lookups.linkedCustomers ?? []) {
      runQuery.mockResolvedValueOnce(customer);
    }
    runQuery.mockResolvedValueOnce(lookups.byEmail ?? null);
    return {
      runAction: vi.fn(),
      runMutation: vi.fn().mockResolvedValue("cus_ignored"),
      runQuery,
    };
  }

  test("getOrCreateCustomer skips a deleted customer linked through subscriptions", async () => {
    stripeMocks.createCustomer.mockResolvedValueOnce({ id: "cus_new" });
    const ctx = getOrCreateCustomerCtx({
      subscriptions: [{ stripeCustomerId: "cus_deleted" }],
      linkedCustomers: [{ stripeCustomerId: "cus_deleted", deleted: true }],
    });
    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    const result = await client.getOrCreateCustomer(ctx, {
      userId: "user_returning",
      email: "returning@example.com",
    });

    expect(result).toEqual({ customerId: "cus_new", isNew: true });
  });

  test("getOrCreateCustomer ignores email matches unless matchByEmail is set", async () => {
    stripeMocks.createCustomer.mockResolvedValueOnce({ id: "cus_fresh" });
    const ctx = getOrCreateCustomerCtx({
      byEmail: { stripeCustomerId: "cus_unclaimed" },
    });
    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    const result = await client.getOrCreateCustomer(ctx, {
      userId: "user_unverified",
      email: "victim@example.com",
    });

    expect(result).toEqual({ customerId: "cus_fresh", isNew: true });
    // Three lookups by user, then the check on the created customer. None
    // by email.
    expect(
      ctx.runQuery.mock.calls.map(([, args]) => Object.keys(args)),
    ).toEqual([["userId"], ["userId"], ["userId"], ["stripeCustomerId"]]);
    expect(stripeMocks.updateCustomer).not.toHaveBeenCalled();
  });

  test("getOrCreateCustomer never matches another user's customer by email", async () => {
    stripeMocks.createCustomer.mockResolvedValueOnce({ id: "cus_mine" });
    const ctx = getOrCreateCustomerCtx({
      byEmail: { stripeCustomerId: "cus_someone_else", userId: "user_other" },
    });
    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    const result = await client.getOrCreateCustomer(ctx, {
      userId: "user_me",
      email: "shared@example.com",
      matchByEmail: true,
    });

    expect(result).toEqual({ customerId: "cus_mine", isNew: true });
    expect(stripeMocks.updateCustomer).not.toHaveBeenCalled();
  });

  test("getOrCreateCustomer claims an unclaimed customer with the same email", async () => {
    stripeMocks.updateCustomer.mockResolvedValueOnce({
      id: "cus_unclaimed",
      email: "claim@example.com",
      name: null,
      metadata: { userId: "user_claimer", plan: "legacy" },
    });
    const ctx = getOrCreateCustomerCtx({
      byEmail: { stripeCustomerId: "cus_unclaimed" },
    });
    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    const result = await client.getOrCreateCustomer(ctx, {
      userId: "user_claimer",
      email: "claim@example.com",
      matchByEmail: true,
    });

    expect(result).toEqual({ customerId: "cus_unclaimed", isNew: false });
    expect(stripeMocks.updateCustomer).toHaveBeenCalledWith("cus_unclaimed", {
      metadata: { userId: "user_claimer" },
    });
    expect(ctx.runMutation).toHaveBeenCalledWith(
      components.stripe.public.createOrUpdateCustomer,
      {
        stripeCustomerId: "cus_unclaimed",
        email: "claim@example.com",
        name: undefined,
        metadata: { userId: "user_claimer", plan: "legacy" },
      },
    );
  });

  test("passes additional checkout session params without allowing mode override", async () => {
    stripeMocks.createCheckoutSession.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    });

    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    const result = await client.createCheckoutSession(
      {
        runAction: vi.fn(),
        runMutation: vi.fn(),
        runQuery: vi.fn(),
      },
      {
        priceId: "price_monthly",
        customerId: "cus_123",
        mode: "subscription",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        quantity: 2,
        metadata: { source: "test" },
        subscriptionMetadata: { userId: "user_123" },
        params: {
          mode: "payment",
          allow_promotion_codes: true,
          line_items: [{ price: "price_override", quantity: 5 }],
        },
      },
    );

    expect(stripeMocks.createCheckoutSession).toHaveBeenCalledWith({
      mode: "subscription",
      line_items: [{ price: "price_override", quantity: 5 }],
      success_url: "https://example.com/success",
      cancel_url: "https://example.com/cancel",
      metadata: { source: "test" },
      customer: "cus_123",
      subscription_data: { metadata: { userId: "user_123" } },
      allow_promotion_codes: true,
    });
    expect(result).toEqual({
      sessionId: "cs_test_123",
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    });
  });

  test("merges checkout params metadata without dropping linkage metadata", async () => {
    stripeMocks.createCheckoutSession.mockResolvedValue({
      id: "cs_metadata_merge",
      url: "https://checkout.stripe.com/c/pay/cs_metadata_merge",
    });

    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    await client.createCheckoutSession(
      {
        runAction: vi.fn(),
        runMutation: vi.fn(),
        runQuery: vi.fn(),
      },
      {
        priceId: "price_monthly",
        mode: "subscription",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        subscriptionMetadata: { userId: "user_123" },
        params: {
          subscription_data: {
            metadata: { couponSource: "landing_page" },
            trial_period_days: 14,
          },
        },
      },
    );

    expect(stripeMocks.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_data: {
          metadata: {
            couponSource: "landing_page",
            userId: "user_123",
          },
          trial_period_days: 14,
        },
      }),
    );

    stripeMocks.createCheckoutSession.mockClear();
    stripeMocks.createCheckoutSession.mockResolvedValue({
      id: "cs_payment_metadata_merge",
      url: "https://checkout.stripe.com/c/pay/cs_payment_metadata_merge",
    });

    await client.createCheckoutSession(
      {
        runAction: vi.fn(),
        runMutation: vi.fn(),
        runQuery: vi.fn(),
      },
      {
        priceId: "price_one_time",
        mode: "payment",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        paymentIntentMetadata: { userId: "user_456" },
        params: {
          payment_intent_data: {
            metadata: { productType: "hat" },
            statement_descriptor: "BENJI HAT",
          },
        },
      },
    );

    expect(stripeMocks.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent_data: {
          metadata: {
            productType: "hat",
            userId: "user_456",
          },
          statement_descriptor: "BENJI HAT",
        },
      }),
    );
  });

  test("omits hosted redirect URLs for non-hosted checkout ui modes", async () => {
    stripeMocks.createCheckoutSession.mockResolvedValue({
      id: "cs_embedded",
      url: null,
    });

    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    await client.createCheckoutSession(
      {
        runAction: vi.fn(),
        runMutation: vi.fn(),
        runQuery: vi.fn(),
      },
      {
        priceId: "price_monthly",
        mode: "subscription",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        params: {
          ui_mode: "embedded_page",
          return_url: "https://example.com/return",
        },
      },
    );

    expect(stripeMocks.createCheckoutSession).toHaveBeenCalledWith({
      mode: "subscription",
      line_items: [{ price: "price_monthly", quantity: 1 }],
      metadata: {},
      ui_mode: "embedded_page",
      return_url: "https://example.com/return",
    });
  });

  test("setup mode sends no line items", async () => {
    stripeMocks.createCheckoutSession.mockClear();
    stripeMocks.createCheckoutSession.mockResolvedValue({
      id: "cs_setup",
      url: "https://checkout.stripe.com/c/pay/cs_setup",
    });
    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    await client.createCheckoutSession(
      { runAction: vi.fn(), runMutation: vi.fn(), runQuery: vi.fn() },
      {
        mode: "setup",
        customerId: "cus_setup",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        params: { currency: "usd" },
      },
    );

    expect(stripeMocks.createCheckoutSession).toHaveBeenCalledWith({
      mode: "setup",
      customer: "cus_setup",
      success_url: "https://example.com/success",
      cancel_url: "https://example.com/cancel",
      metadata: {},
      currency: "usd",
    });
  });

  test("rejects payment_method_types on endive API versions", async () => {
    stripeMocks.createCheckoutSession.mockClear();
    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    await expect(
      client.createCheckoutSession(
        { runAction: vi.fn(), runMutation: vi.fn(), runQuery: vi.fn() },
        {
          priceId: "price_monthly",
          mode: "subscription",
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
          params: { payment_method_types: ["card"] } as any,
        },
      ),
    ).rejects.toThrow(/allowed_payment_method_types/);
    expect(stripeMocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  test("passes payment_method_types through when pinned to an older API version", async () => {
    stripeMocks.createCheckoutSession.mockClear();
    stripeMocks.createCheckoutSession.mockResolvedValue({
      id: "cs_dahlia",
      url: "https://checkout.stripe.com/c/pay/cs_dahlia",
    });
    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
      apiVersion: "2026-08-26.dahlia",
    });

    await client.createCheckoutSession(
      { runAction: vi.fn(), runMutation: vi.fn(), runQuery: vi.fn() },
      {
        priceId: "price_monthly",
        mode: "subscription",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        params: { payment_method_types: ["card"] } as any,
      },
    );

    expect(stripeMocks.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method_types: ["card"] }),
    );
  });

  test("keeps redirect URLs for legacy hosted checkout ui mode", async () => {
    stripeMocks.createCheckoutSession.mockResolvedValue({
      id: "cs_hosted",
      url: "https://checkout.stripe.com/c/pay/cs_hosted",
    });

    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    await client.createCheckoutSession(
      {
        runAction: vi.fn(),
        runMutation: vi.fn(),
        runQuery: vi.fn(),
      },
      {
        priceId: "price_monthly",
        mode: "subscription",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        params: {
          ui_mode: "hosted" as any,
        },
      },
    );

    expect(stripeMocks.createCheckoutSession).toHaveBeenCalledWith({
      mode: "subscription",
      line_items: [{ price: "price_monthly", quantity: 1 }],
      success_url: "https://example.com/success",
      cancel_url: "https://example.com/cancel",
      metadata: {},
      ui_mode: "hosted",
    });
  });
});

function getWebhookHandler(config: RegisterRoutesConfig) {
  const route = vi.fn();
  registerRoutes({ route } as unknown as HttpRouter, components.stripe, config);
  return route.mock.calls[0][0].handler._handler as (
    ctx: unknown,
    request: Request,
  ) => Promise<Response>;
}

function webhookRequest() {
  return new Request("https://example.convex.site/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=sig_leak" },
    body: JSON.stringify({ email: "leak@example.com" }),
  });
}

function captureConsole() {
  const spies = (["error", "warn", "log"] as const).map((method) =>
    vi.spyOn(console, method).mockImplementation(() => {}),
  );
  return {
    stop: () => {
      const output = spies
        .flatMap((spy) => spy.mock.calls.flat())
        .map((arg) =>
          arg instanceof Error
            ? `${arg.message} ${arg.stack} ${JSON.stringify(arg)}`
            : typeof arg === "string"
              ? arg
              : JSON.stringify(arg),
        )
        .join("\n");
      spies.forEach((spy) => spy.mockRestore());
      return output;
    },
  };
}

describe("registerRoutes", () => {
  test("registerRoutes function should be exported", () => {
    expect(typeof registerRoutes).toBe("function");
  });

  test("signature failures log a fixed message and reach onError", async () => {
    const signatureError = Object.assign(new Error("bad signature"), {
      payload: '{"email":"leak@example.com"}',
      header: "t=1,v1=sig_leak",
    });
    stripeMocks.constructEvent.mockRejectedValueOnce(signatureError);
    const onError = vi.fn();
    const handler = getWebhookHandler({
      STRIPE_WEBHOOK_SECRET: "whsec_test",
      STRIPE_SECRET_KEY: "sk_test_123",
      onError,
    });
    const logs = captureConsole();

    const response = await handler({}, webhookRequest());

    const output = logs.stop();
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Webhook signature verification failed");
    expect(output).toContain("Webhook signature verification failed");
    expect(output).not.toMatch(/leak@example\.com|sig_leak|bad signature/);
    expect(onError).toHaveBeenCalledWith({}, signatureError, {
      stage: "signature",
    });
  });

  test("processing failures return 500 and log only the event ID and type", async () => {
    const event = {
      id: "evt_leak",
      type: "customer.created",
      data: {
        object: { id: "cus_leak", email: "leak@example.com", metadata: {} },
      },
    };
    stripeMocks.constructEvent.mockResolvedValueOnce(event);
    const mutationError = Object.assign(
      new Error("Object: {email: leak@example.com}"),
      { raw: { headers: { "request-id": "req_leak" } } },
    );
    const ctx = {
      runQuery: vi.fn().mockResolvedValue(false),
      runMutation: vi.fn().mockRejectedValue(mutationError),
    };
    const onError = vi.fn();
    const onEvent = vi.fn();
    const handler = getWebhookHandler({
      STRIPE_WEBHOOK_SECRET: "whsec_test",
      STRIPE_SECRET_KEY: "sk_test_123",
      onError,
      onEvent,
    });
    const logs = captureConsole();

    const response = await handler(ctx, webhookRequest());

    const output = logs.stop();
    expect(response.status).toBe(500);
    expect(output).toContain("evt_leak");
    expect(output).toContain("customer.created");
    expect(output).not.toMatch(/leak@example\.com|req_leak|sig_leak/);
    expect(onEvent).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(ctx, mutationError, {
      stage: "processing",
      event,
    });
  });

  test("a throwing onError handler does not change the response", async () => {
    stripeMocks.constructEvent.mockRejectedValueOnce(
      new Error("bad signature"),
    );
    const handler = getWebhookHandler({
      STRIPE_WEBHOOK_SECRET: "whsec_test",
      STRIPE_SECRET_KEY: "sk_test_123",
      onError: () => {
        throw new Error("reporter down");
      },
    });
    const logs = captureConsole();

    const response = await handler({}, webhookRequest());

    expect(logs.stop()).not.toContain("reporter down");
    expect(response.status).toBe(400);
  });
});

function paymentIntentEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_test",
        customer: "cus_test",
        amount: 4900,
        currency: "usd",
        status: "succeeded",
        created: 1_700_000_123,
        metadata: {},
        ...overrides,
      },
    },
  };
}

function mockStripeForInvoiceLookup(options: {
  invoicePayments?: Array<{ invoice: unknown }>;
  invoice?: Record<string, unknown>;
}) {
  return {
    invoicePayments: {
      list: vi.fn().mockResolvedValue({ data: options.invoicePayments ?? [] }),
    },
    invoices: {
      retrieve: vi.fn().mockResolvedValue(options.invoice),
    },
  };
}

describe("processEvent", () => {
  test("records one-time payments even when the customer recently subscribed", async () => {
    const processEvent = (clientModule as any).processEvent;
    const ctx = {
      runMutation: vi.fn().mockResolvedValue(null),
      runQuery: vi.fn(),
    };
    const stripe = mockStripeForInvoiceLookup({});

    await processEvent(
      ctx,
      components.stripe,
      paymentIntentEvent({
        id: "pi_one_time_after_sub",
        customer: "cus_recent",
        metadata: { userId: "user_recent" },
      }),
      stripe,
    );

    expect(stripe.invoicePayments.list).toHaveBeenCalledWith({
      payment: {
        type: "payment_intent",
        payment_intent: "pi_one_time_after_sub",
      },
      limit: 1,
    });
    expect(ctx.runMutation).toHaveBeenCalledWith(
      components.stripe.private.handlePaymentIntentSucceeded,
      {
        stripePaymentIntentId: "pi_one_time_after_sub",
        stripeCustomerId: "cus_recent",
        amount: 4900,
        currency: "usd",
        status: "succeeded",
        created: 1_700_000_123,
        metadata: { userId: "user_recent" },
      },
    );
  });

  test("links v22 invoice events through parent subscription details", async () => {
    const processEvent = (clientModule as any).processEvent;
    const ctx = {
      runMutation: vi.fn().mockResolvedValue(null),
      runQuery: vi.fn(),
    };

    await processEvent(
      ctx,
      components.stripe,
      {
        type: "invoice.updated",
        data: {
          object: {
            id: "in_v22",
            customer: "cus_v22",
            status: "open",
            amount_due: 1234,
            amount_paid: 0,
            created: 1_700_000_001,
            metadata: {},
            parent: {
              subscription_details: {
                subscription: "sub_v22",
                metadata: {
                  userId: "user_v22",
                  orgId: "org_v22",
                },
              },
            },
          },
        },
      },
      {},
    );

    expect(ctx.runMutation).toHaveBeenCalledWith(
      components.stripe.private.handleInvoiceCreated,
      {
        stripeInvoiceId: "in_v22",
        stripeCustomerId: "cus_v22",
        stripeSubscriptionId: "sub_v22",
        status: "open",
        amountDue: 1234,
        amountPaid: 0,
        created: 1_700_000_001,
        metadata: {
          userId: "user_v22",
          orgId: "org_v22",
        },
      },
    );
  });

  test("skips subscription payments linked through invoice payments", async () => {
    const processEvent = (clientModule as any).processEvent;
    const ctx = { runMutation: vi.fn(), runQuery: vi.fn() };
    const stripe = mockStripeForInvoiceLookup({
      invoicePayments: [{ invoice: "in_renewal" }],
      invoice: {
        id: "in_renewal",
        parent: { subscription_details: { subscription: "sub_renewal" } },
      },
    });

    await processEvent(ctx, components.stripe, paymentIntentEvent(), stripe);

    expect(stripe.invoices.retrieve).toHaveBeenCalledWith("in_renewal");
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  test("records payments for invoices that are not part of a subscription", async () => {
    const processEvent = (clientModule as any).processEvent;
    const ctx = { runMutation: vi.fn(), runQuery: vi.fn() };
    const stripe = mockStripeForInvoiceLookup({
      invoicePayments: [{ invoice: { id: "in_one_off", parent: null } }],
    });

    await processEvent(ctx, components.stripe, paymentIntentEvent(), stripe);

    expect(stripe.invoices.retrieve).not.toHaveBeenCalled();
    expect(ctx.runMutation).toHaveBeenCalledWith(
      components.stripe.private.handlePaymentIntentSucceeded,
      expect.objectContaining({ stripePaymentIntentId: "pi_test" }),
    );
  });

  test("uses the legacy PaymentIntent.invoice field when the payload has it", async () => {
    const processEvent = (clientModule as any).processEvent;
    const ctx = { runMutation: vi.fn(), runQuery: vi.fn() };
    const stripe = mockStripeForInvoiceLookup({
      invoice: { id: "in_legacy", subscription: "sub_legacy" },
    });

    await processEvent(
      ctx,
      components.stripe,
      paymentIntentEvent({ invoice: "in_legacy" }),
      stripe,
    );

    expect(stripe.invoicePayments.list).not.toHaveBeenCalled();
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  test("propagates invoice lookup failures instead of recording the payment", async () => {
    const processEvent = (clientModule as any).processEvent;
    const ctx = { runMutation: vi.fn(), runQuery: vi.fn() };
    const stripe = mockStripeForInvoiceLookup({});
    stripe.invoicePayments.list.mockRejectedValue(new Error("Stripe is down"));

    await expect(
      processEvent(ctx, components.stripe, paymentIntentEvent(), stripe),
    ).rejects.toThrow("Stripe is down");
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  test("propagates checkout invoice sync failures so Stripe retries", async () => {
    const processEvent = (clientModule as any).processEvent;
    const ctx = {
      runMutation: vi.fn().mockResolvedValue(null),
      runQuery: vi.fn(),
    };
    const stripe = {
      subscriptions: {
        retrieve: vi.fn().mockRejectedValue(new Error("invalid api key")),
      },
    };

    await expect(
      processEvent(
        ctx,
        components.stripe,
        {
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_sub",
              customer: "cus_sub",
              mode: "subscription",
              subscription: "sub_checkout",
              metadata: {},
            },
          },
        },
        stripe,
      ),
    ).rejects.toThrow("invalid api key");
  });

  test("charge.refunded passes the refund totals to the component", async () => {
    const processEvent = (clientModule as any).processEvent;
    const ctx = { runMutation: vi.fn(), runQuery: vi.fn() };

    await processEvent(
      ctx,
      components.stripe,
      {
        type: "charge.refunded",
        data: {
          object: {
            id: "ch_refunded",
            payment_intent: { id: "pi_refunded" },
            amount_refunded: 1500,
            refunded: false,
          },
        },
      },
      {},
    );

    expect(ctx.runMutation).toHaveBeenCalledWith(
      components.stripe.private.handleChargeRefunded,
      {
        stripePaymentIntentId: "pi_refunded",
        amountRefunded: 1500,
        refunded: false,
      },
    );
  });

  test("charge.refunded without a payment intent is skipped", async () => {
    const processEvent = (clientModule as any).processEvent;
    const ctx = { runMutation: vi.fn(), runQuery: vi.fn() };
    const logs = captureConsole();

    await processEvent(
      ctx,
      components.stripe,
      {
        type: "charge.refunded",
        data: {
          object: {
            id: "ch_no_intent",
            payment_intent: null,
            amount_refunded: 500,
            refunded: true,
          },
        },
      },
      {},
    );

    expect(logs.stop()).toContain("ch_no_intent");
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  test("skips invoices that have no customer", async () => {
    const processEvent = (clientModule as any).processEvent;
    const ctx = { runMutation: vi.fn(), runQuery: vi.fn() };
    const logs = captureConsole();

    await processEvent(
      ctx,
      components.stripe,
      {
        type: "invoice.finalized",
        data: {
          object: {
            id: "in_no_customer",
            customer: null,
            status: "open",
            amount_due: 100,
            amount_paid: 0,
            created: 1_700_000_002,
            metadata: {},
          },
        },
      },
      {},
    );

    expect(logs.stop()).toContain("in_no_customer");
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  test("reads expanded customer objects on subscription events", async () => {
    const processEvent = (clientModule as any).processEvent;
    const ctx = { runMutation: vi.fn(), runQuery: vi.fn() };

    await processEvent(
      ctx,
      components.stripe,
      {
        type: "customer.subscription.created",
        created: 1_800_000_123,
        data: {
          object: {
            id: "sub_expanded",
            customer: { id: "cus_expanded", object: "customer" },
            status: "active",
            cancel_at_period_end: false,
            cancel_at: null,
            metadata: {},
            items: {
              data: [
                {
                  current_period_end: 1_800_000_000,
                  quantity: 1,
                  price: { id: "price_expanded" },
                },
              ],
            },
          },
        },
      },
      {},
    );

    expect(ctx.runMutation.mock.calls[0][1]).toMatchObject({
      stripeSubscriptionId: "sub_expanded",
      stripeCustomerId: "cus_expanded",
      eventCreated: 1_800_000_123,
    });
  });
});

function subscriptionEvent(
  type: string,
  subscription: Record<string, unknown> = {},
) {
  return {
    type,
    created: 1_800_000_500,
    data: {
      object: {
        id: "sub_test",
        customer: "cus_test",
        status: "active",
        cancel_at_period_end: false,
        cancel_at: null,
        metadata: { userId: "user_test" },
        items: {
          data: [
            {
              current_period_end: 1_800_000_000,
              quantity: 3,
              price: { id: "price_test" },
            },
          ],
        },
        ...subscription,
      },
    },
  };
}

// A payload with the period end only on the subscription, which older API
// versions also send there.
const legacySubscription = {
  current_period_end: 1_700_000_000,
  items: { data: [{ quantity: 3, price: { id: "price_test" } }] },
};

describe("review fixes for 0.2.0", () => {
  const processEvent = (clientModule as any).processEvent;

  test.each([
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ])(
    "%s reads the period end from the subscription when the item has none",
    async (type) => {
      const ctx = { runMutation: vi.fn(), runQuery: vi.fn() };

      await processEvent(
        ctx,
        components.stripe,
        subscriptionEvent(type, legacySubscription),
        {},
      );

      expect(ctx.runMutation.mock.calls[0][1]).toMatchObject({
        currentPeriodEnd: 1_700_000_000,
      });
    },
  );

  test("subscription events prefer the item's period end", async () => {
    const ctx = { runMutation: vi.fn(), runQuery: vi.fn() };

    await processEvent(
      ctx,
      components.stripe,
      subscriptionEvent("customer.subscription.updated", {
        current_period_end: 1_700_000_000,
      }),
      {},
    );

    expect(ctx.runMutation.mock.calls[0][1]).toMatchObject({
      currentPeriodEnd: 1_800_000_000,
    });
  });

  test("cancelSubscription syncs the period end from the subscription when the item has none", async () => {
    stripeMocks.cancelSubscription.mockResolvedValueOnce({
      id: "sub_legacy",
      customer: "cus_legacy",
      status: "canceled",
      cancel_at_period_end: false,
      cancel_at: null,
      metadata: {},
      ...legacySubscription,
    });
    const ctx = { runAction: vi.fn(), runMutation: vi.fn(), runQuery: vi.fn() };
    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    await client.cancelSubscription(ctx, {
      stripeSubscriptionId: "sub_legacy",
      cancelAtPeriodEnd: false,
    });

    expect(ctx.runMutation.mock.calls[0][1]).toMatchObject({
      currentPeriodEnd: 1_700_000_000,
    });
  });

  test("customer.subscription.deleted sends enough to store an unknown subscription", async () => {
    const ctx = { runMutation: vi.fn(), runQuery: vi.fn() };

    await processEvent(
      ctx,
      components.stripe,
      subscriptionEvent("customer.subscription.deleted", {
        status: "canceled",
      }),
      {},
    );

    expect(ctx.runMutation).toHaveBeenCalledWith(
      components.stripe.private.handleSubscriptionDeleted,
      {
        stripeSubscriptionId: "sub_test",
        stripeCustomerId: "cus_test",
        priceId: "price_test",
        quantity: 3,
        metadata: { userId: "user_test" },
        cancelAtPeriodEnd: false,
        currentPeriodEnd: 1_800_000_000,
        cancelAt: undefined,
        eventCreated: 1_800_000_500,
      },
    );
  });

  test("createCheckoutSession merges params.metadata with the metadata argument", async () => {
    stripeMocks.createCheckoutSession.mockClear();
    stripeMocks.createCheckoutSession.mockResolvedValue({
      id: "cs_session_metadata",
      url: "https://checkout.stripe.com/c/pay/cs_session_metadata",
    });
    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    await client.createCheckoutSession(
      { runAction: vi.fn(), runMutation: vi.fn(), runQuery: vi.fn() },
      {
        priceId: "price_one_time",
        mode: "payment",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        metadata: { userId: "user_123", source: "argument" },
        params: { metadata: { campaign: "spring", source: "params" } },
      },
    );

    expect(stripeMocks.createCheckoutSession.mock.calls[0][0].metadata).toEqual(
      { campaign: "spring", userId: "user_123", source: "argument" },
    );
  });

  test.each([
    ["checkout.session.completed", "unpaid"],
    ["checkout.session.async_payment_succeeded", "paid"],
    ["checkout.session.async_payment_failed", "unpaid"],
  ])("%s stores the payment status", async (type, paymentStatus) => {
    const ctx = { runMutation: vi.fn(), runQuery: vi.fn() };

    await processEvent(
      ctx,
      components.stripe,
      {
        type,
        created: 1_800_000_000,
        data: {
          object: {
            id: "cs_async",
            customer: "cus_async",
            mode: "payment",
            payment_status: paymentStatus,
            payment_intent: null,
            metadata: { userId: "user_async" },
          },
        },
      },
      {},
    );

    expect(ctx.runMutation).toHaveBeenCalledWith(
      components.stripe.private.handleCheckoutSessionCompleted,
      {
        stripeCheckoutSessionId: "cs_async",
        stripeCustomerId: "cus_async",
        mode: "payment",
        paymentStatus,
        metadata: { userId: "user_async" },
      },
    );
  });

  function refundEvent(type: string, refund: Record<string, unknown>) {
    return {
      type,
      created: 1_800_000_000,
      data: { object: { id: "re_test", charge: "ch_test", ...refund } },
    };
  }

  test.each(["refund.failed", "refund.updated", "charge.refund.updated"])(
    "a failed refund in %s re-reads the charge's refund total",
    async (type) => {
      const ctx = { runMutation: vi.fn(), runQuery: vi.fn() };
      const stripe = {
        charges: {
          retrieve: vi.fn().mockResolvedValue({
            id: "ch_test",
            payment_intent: "pi_test",
            amount_refunded: 1000,
            refunded: false,
          }),
        },
      };

      await processEvent(
        ctx,
        components.stripe,
        refundEvent(type, { status: "failed" }),
        stripe,
      );

      expect(stripe.charges.retrieve).toHaveBeenCalledWith("ch_test");
      expect(ctx.runMutation).toHaveBeenCalledWith(
        components.stripe.private.handleChargeRefunded,
        {
          stripePaymentIntentId: "pi_test",
          amountRefunded: 1000,
          refunded: false,
          authoritative: true,
        },
      );
    },
  );

  test("a refund update that didn't fail makes no Stripe call", async () => {
    const ctx = { runMutation: vi.fn(), runQuery: vi.fn() };
    const stripe = { charges: { retrieve: vi.fn() } };

    await processEvent(
      ctx,
      components.stripe,
      refundEvent("refund.updated", { status: "succeeded" }),
      stripe,
    );

    expect(stripe.charges.retrieve).not.toHaveBeenCalled();
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  test("getOrCreateCustomer with matchByEmail asks for an unclaimed customer", async () => {
    stripeMocks.createCustomer.mockResolvedValueOnce({ id: "cus_new_email" });
    const ctx = {
      runAction: vi.fn(),
      runMutation: vi.fn().mockResolvedValue("cus_ignored"),
      runQuery: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ stripeCustomerId: "cus_new_email" }),
    };
    const client = new StripeSubscriptions(components.stripe, {
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    await client.getOrCreateCustomer(ctx, {
      userId: "user_email",
      email: "shared@example.com",
      matchByEmail: true,
    });

    expect(ctx.runQuery).toHaveBeenCalledWith(
      components.stripe.public.getCustomerByEmail,
      { email: "shared@example.com", unclaimed: true },
    );
  });
});
