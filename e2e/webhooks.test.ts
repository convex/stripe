import { describe, expect, test } from "vitest";
import {
  type Customer,
  type Invoice,
  type Subscription,
  deliver,
  deliverUntilAccepted,
  nowSeconds,
  runAsUser,
  runComponent,
  stripeEvent,
  uniqueId,
} from "./helpers.js";

function customerObject(id: string, userId: string, name = "E2E Customer") {
  return {
    id,
    object: "customer",
    email: `${userId}@example.com`,
    name,
    metadata: { userId },
  };
}

function subscriptionObject(
  id: string,
  customerId: string,
  userId: string,
  status: string,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    object: "subscription",
    customer: customerId,
    status,
    cancel_at_period_end: false,
    cancel_at: null,
    metadata: { userId, orgId: `org_${userId}` },
    items: {
      data: [
        {
          current_period_end: nowSeconds() + 30 * 24 * 60 * 60,
          quantity: 2,
          price: { id: "price_e2e_team" },
        },
      ],
    },
    ...extra,
  };
}

describe("webhook route on a real Convex backend", () => {
  test("rejects unsigned requests and wrong signatures", async () => {
    const event = stripeEvent(
      "customer.created",
      customerObject(uniqueId("cus"), uniqueId("user")),
    );

    expect((await deliver(event, { signed: false })).status).toBe(400);
    expect(
      (await deliver(event, { secret: "whsec_not_the_real_secret" })).status,
    ).toBe(400);
  });

  test("syncs a new customer and links it to its user", async () => {
    const userId = uniqueId("user");
    const customerId = uniqueId("cus");

    const response = await deliver(
      stripeEvent("customer.created", customerObject(customerId, userId)),
    );

    expect(response.status).toBe(200);
    const customer = await runComponent<Customer>(
      "public:getCustomerByUserId",
      { userId },
    );
    expect(customer).toMatchObject({
      stripeCustomerId: customerId,
      email: `${userId}@example.com`,
    });
  });

  test("ignores a redelivered event instead of applying it again", async () => {
    const userId = uniqueId("user");
    const customerId = uniqueId("cus");
    const eventId = uniqueId("evt");
    await deliver(
      stripeEvent("customer.created", customerObject(customerId, userId)),
    );

    await deliver(
      stripeEvent(
        "customer.updated",
        customerObject(customerId, userId, "First"),
        { id: eventId },
      ),
    );
    const redelivery = await deliver(
      stripeEvent(
        "customer.updated",
        customerObject(customerId, userId, "Changed"),
        { id: eventId },
      ),
    );

    expect(redelivery.status).toBe(200);
    const customer = await runComponent<Customer>("public:getCustomer", {
      stripeCustomerId: customerId,
    });
    expect(customer?.name).toBe("First");
  });

  test("late subscription events do not roll back newer state", async () => {
    const userId = uniqueId("user");
    const customerId = uniqueId("cus");
    const subscriptionId = uniqueId("sub");
    const start = nowSeconds();
    const send = (type: string, status: string, created: number) =>
      deliver(
        stripeEvent(
          type,
          subscriptionObject(subscriptionId, customerId, userId, status),
          { created },
        ),
      );
    const readStatus = async () =>
      (
        await runComponent<Subscription>("public:getSubscription", {
          stripeSubscriptionId: subscriptionId,
        })
      )?.status;

    await send("customer.subscription.created", "active", start);
    await send("customer.subscription.updated", "past_due", start + 20);
    await send("customer.subscription.updated", "active", start + 10);
    expect(await readStatus()).toBe("past_due");

    await send("customer.subscription.deleted", "canceled", start + 30);
    await send("customer.subscription.updated", "active", start + 40);
    expect(await readStatus()).toBe("canceled");
  });

  test("a burst of events for one invoice ends in its final state", async () => {
    const userId = uniqueId("user");
    const invoiceId = uniqueId("in");
    const start = nowSeconds();
    const invoice = (status: string, amountPaid: number) => ({
      id: invoiceId,
      object: "invoice",
      customer: uniqueId("cus"),
      status,
      amount_due: 2_000,
      amount_paid: amountPaid,
      created: start,
      metadata: {},
      parent: {
        subscription_details: {
          subscription: uniqueId("sub"),
          metadata: { userId },
        },
      },
    });

    const responses = await Promise.all([
      deliverUntilAccepted(stripeEvent("invoice.created", invoice("draft", 0))),
      deliverUntilAccepted(
        stripeEvent("invoice.finalized", invoice("open", 0)),
      ),
      deliverUntilAccepted(stripeEvent("invoice.updated", invoice("open", 0))),
      deliverUntilAccepted(stripeEvent("invoice.paid", invoice("paid", 2_000))),
      deliverUntilAccepted(
        stripeEvent("invoice.payment_succeeded", invoice("paid", 2_000)),
      ),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200, 200, 200,
    ]);
    const invoices = await runComponent<Invoice[]>(
      "public:listInvoicesByUserId",
      { userId },
    );
    expect(invoices).toEqual([
      expect.objectContaining({
        stripeInvoiceId: invoiceId,
        status: "paid",
        amountPaid: 2_000,
      }),
    ]);
  });

  test("the example app's queries return synced subscriptions only to their owner", async () => {
    const userId = uniqueId("user");
    const customerId = uniqueId("cus");
    const subscriptionId = uniqueId("sub");
    const cancelAt = nowSeconds() + 30 * 24 * 60 * 60;
    await deliver(
      stripeEvent(
        "customer.subscription.created",
        subscriptionObject(subscriptionId, customerId, userId, "active", {
          cancel_at_period_end: true,
          cancel_at: cancelAt,
        }),
      ),
    );

    const subscriptions = await runAsUser<Subscription[]>(
      "stripe:getUserSubscriptions",
      {},
      userId,
    );
    expect(subscriptions).toEqual([
      expect.objectContaining({
        stripeSubscriptionId: subscriptionId,
        cancelAtPeriodEnd: true,
        cancelAt,
      }),
    ]);

    const orgId = `org_${userId}`;
    const ownView = await runAsUser<Subscription>(
      "stripe:getOrgSubscription",
      { orgId },
      userId,
    );
    const otherView = await runAsUser<Subscription>(
      "stripe:getOrgSubscription",
      { orgId },
      uniqueId("someone_else"),
    );
    expect(ownView?.stripeSubscriptionId).toBe(subscriptionId);
    expect(otherView).toBeNull();
  });

  test("a deleted customer is no longer returned for its user", async () => {
    const userId = uniqueId("user");
    const customerId = uniqueId("cus");
    await deliver(
      stripeEvent("customer.created", customerObject(customerId, userId)),
    );

    await deliver(
      stripeEvent("customer.deleted", {
        id: customerId,
        object: "customer",
        deleted: true,
      }),
    );

    expect(
      await runComponent<Customer>("public:getCustomerByUserId", { userId }),
    ).toBeNull();
    const customer = await runComponent<Customer>("public:getCustomer", {
      stripeCustomerId: customerId,
    });
    expect(customer?.deleted).toBe(true);
    expect(customer?.email).toBeUndefined();
  });

  test("the example's billing portal action skips a customer Stripe deleted", async () => {
    const userId = uniqueId("user");
    const customerId = uniqueId("cus");
    await deliver(
      stripeEvent("customer.created", customerObject(customerId, userId)),
    );
    await deliver(
      stripeEvent(
        "customer.subscription.created",
        subscriptionObject(uniqueId("sub"), customerId, userId, "active"),
      ),
    );
    await deliver(
      stripeEvent("customer.deleted", {
        id: customerId,
        object: "customer",
        deleted: true,
      }),
    );

    // The subscription still points at the deleted customer. Asking Stripe
    // for its portal would fail, so the action has to return null instead.
    expect(
      await runAsUser("stripe:getCustomerPortalUrl", {}, userId),
    ).toBeNull();
  });

  test("records a completed one-time checkout", async () => {
    const sessionId = uniqueId("cs");
    const customerId = uniqueId("cus");

    const response = await deliver(
      stripeEvent("checkout.session.completed", {
        id: sessionId,
        object: "checkout.session",
        customer: customerId,
        mode: "payment",
        payment_intent: uniqueId("pi"),
        metadata: { productType: "hat" },
      }),
    );

    expect(response.status).toBe(200);
    expect(
      await runComponent("public:getCheckoutSession", {
        stripeCheckoutSessionId: sessionId,
      }),
    ).toMatchObject({
      stripeCustomerId: customerId,
      status: "complete",
      mode: "payment",
    });
  });

  test("keeps a subscription canceled when its deletion arrives before its creation", async () => {
    const userId = uniqueId("user");
    const customerId = uniqueId("cus");
    const subscriptionId = uniqueId("sub");
    const createdAt = nowSeconds() - 60;

    const deleted = await deliver(
      stripeEvent(
        "customer.subscription.deleted",
        subscriptionObject(subscriptionId, customerId, userId, "canceled"),
        { created: createdAt + 30 },
      ),
    );
    const created = await deliver(
      stripeEvent(
        "customer.subscription.created",
        subscriptionObject(subscriptionId, customerId, userId, "active"),
        { created: createdAt },
      ),
    );

    expect(deleted.status).toBe(200);
    expect(created.status).toBe(200);
    expect(
      await runComponent<Subscription>("public:getSubscription", {
        stripeSubscriptionId: subscriptionId,
      }),
    ).toMatchObject({
      stripeCustomerId: customerId,
      status: "canceled",
      priceId: "price_e2e_team",
      userId,
    });
  });

  test("reads the period end from a webhook endpoint on an older API version", async () => {
    const userId = uniqueId("user");
    const subscriptionId = uniqueId("sub");
    const periodEnd = nowSeconds() + 7 * 24 * 60 * 60;

    await deliver(
      stripeEvent(
        "customer.subscription.created",
        subscriptionObject(subscriptionId, uniqueId("cus"), userId, "active", {
          current_period_end: periodEnd,
          items: { data: [{ quantity: 1, price: { id: "price_e2e_team" } }] },
        }),
      ),
    );

    expect(
      await runComponent<Subscription>("public:getSubscription", {
        stripeSubscriptionId: subscriptionId,
      }),
    ).toMatchObject({ currentPeriodEnd: periodEnd });
  });

  test("marks a checkout paid only when its delayed payment succeeds", async () => {
    const sessionId = uniqueId("cs");
    const session = (paymentStatus: string) => ({
      id: sessionId,
      object: "checkout.session",
      customer: uniqueId("cus"),
      mode: "payment",
      payment_status: paymentStatus,
      payment_intent: null,
      metadata: {},
    });
    const stored = () =>
      runComponent<{ paymentStatus?: string }>("public:getCheckoutSession", {
        stripeCheckoutSessionId: sessionId,
      });

    await deliver(stripeEvent("checkout.session.completed", session("unpaid")));
    expect(await stored()).toMatchObject({
      status: "complete",
      paymentStatus: "unpaid",
    });

    await deliver(
      stripeEvent("checkout.session.async_payment_succeeded", session("paid")),
    );
    expect(await stored()).toMatchObject({ paymentStatus: "paid" });
  });

  test("runs the handlers once when an event is delivered twice at the same time", async () => {
    const customerId = uniqueId("cus");
    const event = stripeEvent(
      "customer.created",
      customerObject(customerId, uniqueId("user")),
    );

    const responses = await Promise.all([deliver(event), deliver(event)]);
    const statuses = responses.map((response) => response.status).sort();

    // One delivery wins. The other is either told the event is in progress
    // or, if it arrived after the first finished, that it's already done.
    expect([
      [200, 200],
      [200, 409],
    ]).toContainEqual(statuses);
    expect((await deliver(event)).status).toBe(200);
    expect(
      await runComponent<Customer>("public:getCustomer", {
        stripeCustomerId: customerId,
      }),
    ).toMatchObject({ stripeCustomerId: customerId });
  });
});
