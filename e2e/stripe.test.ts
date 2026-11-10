import { setTimeout as sleep } from "node:timers/promises";
import StripeSDK from "stripe";
import { beforeAll, describe, expect, inject, test } from "vitest";
import {
  type Customer,
  type Invoice,
  type Payment,
  type Subscription,
  runAsUser,
  runComponent,
  uniqueId,
  waitFor,
} from "./helpers.js";

const PRICE_LOOKUP_KEY = "convex_stripe_component_e2e_monthly";

describe.skipIf(!inject("stripeEnabled"))("real Stripe test mode", () => {
  let stripe: StripeSDK;
  let priceId: string;

  beforeAll(async () => {
    stripe = new StripeSDK(process.env.STRIPE_E2E_SECRET_KEY!);
    const existing = await stripe.prices.list({
      lookup_keys: [PRICE_LOOKUP_KEY],
      limit: 1,
    });
    priceId =
      existing.data[0]?.id ??
      (
        await stripe.prices.create({
          currency: "usd",
          unit_amount: 1_000,
          recurring: { interval: "month" },
          lookup_key: PRICE_LOOKUP_KEY,
          transfer_lookup_key: true,
          product_data: { name: "Convex Stripe component e2e" },
        })
      ).id;
  });

  test("syncs a subscription's lifecycle, and only one-time charges become payments", async () => {
    const userId = uniqueId("user");
    const customer = await stripe.customers.create({
      email: `${userId}@example.com`,
      metadata: { userId },
    });
    const paymentMethod = await stripe.paymentMethods.attach("pm_card_visa", {
      customer: customer.id,
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      default_payment_method: paymentMethod.id,
      metadata: { userId },
    });
    expect(subscription.status).toBe("active");

    await waitFor(
      () => runComponent<Customer>("public:getCustomerByUserId", { userId }),
      (synced) => synced?.stripeCustomerId === customer.id,
    );
    await waitFor(
      () =>
        runComponent<Subscription[]>("public:listSubscriptionsByUserId", {
          userId,
        }),
      (synced) =>
        synced?.[0]?.stripeSubscriptionId === subscription.id &&
        synced[0].status === "active" &&
        synced[0].priceId === priceId,
    );
    await waitFor(
      () => runComponent<Invoice[]>("public:listInvoicesByUserId", { userId }),
      (synced) =>
        !!synced?.some(
          (invoice) =>
            invoice.stripeSubscriptionId === subscription.id &&
            invoice.status === "paid",
        ),
    );

    const oneTime = await stripe.paymentIntents.create({
      amount: 500,
      currency: "usd",
      customer: customer.id,
      payment_method: paymentMethod.id,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: { userId },
    });
    expect(oneTime.status).toBe("succeeded");
    await waitFor(
      () => runComponent<Payment[]>("public:listPaymentsByUserId", { userId }),
      (synced) =>
        !!synced?.some(
          (payment) => payment.stripePaymentIntentId === oneTime.id,
        ),
    );

    const latestInvoiceId =
      typeof subscription.latest_invoice === "string"
        ? subscription.latest_invoice
        : subscription.latest_invoice?.id;
    const invoicePayments = await stripe.invoicePayments.list({
      invoice: latestInvoiceId,
    });
    const renewalPaymentIntent =
      invoicePayments.data[0]?.payment.payment_intent;
    const renewalPaymentIntentId =
      typeof renewalPaymentIntent === "string"
        ? renewalPaymentIntent
        : renewalPaymentIntent?.id;
    expect(renewalPaymentIntentId).toBeDefined();
    // Give the subscription's payment_intent.succeeded time to arrive before
    // checking that it was not stored as a one-time payment.
    await sleep(5_000);
    const payments = await runComponent<Payment[]>("public:listPayments", {
      stripeCustomerId: customer.id,
    });
    expect(payments?.map((payment) => payment.stripePaymentIntentId)).toEqual([
      oneTime.id,
    ]);

    // A partial refund, then the rest. Stripe leaves the payment intent
    // "succeeded", so the refund has to show up in the two refund fields.
    const readOneTime = () =>
      runComponent<Payment>("public:getPayment", {
        stripePaymentIntentId: oneTime.id,
      });
    await stripe.refunds.create({ payment_intent: oneTime.id, amount: 200 });
    await waitFor(readOneTime, (synced) => synced?.amountRefunded === 200);
    expect((await readOneTime())?.refunded).toBe(false);
    await stripe.refunds.create({ payment_intent: oneTime.id });
    const refunded = await waitFor(
      readOneTime,
      (synced) => synced?.refunded === true,
    );
    expect(refunded?.amountRefunded).toBe(500);
    // The example's query passes the refunded payment through its validator.
    const userPayments = await runAsUser<Payment[]>(
      "stripe:getUserPayments",
      {},
      userId,
    );
    expect(userPayments).toEqual([
      expect.objectContaining({ refunded: true, amountRefunded: 500 }),
    ]);

    await stripe.subscriptions.cancel(subscription.id);
    await waitFor(
      () =>
        runComponent<Subscription>("public:getSubscription", {
          stripeSubscriptionId: subscription.id,
        }),
      (synced) => synced?.status === "canceled",
    );

    await stripe.customers.del(customer.id);
    await waitFor(
      () =>
        runComponent<Customer>("public:getCustomer", {
          stripeCustomerId: customer.id,
        }),
      (synced) => synced?.deleted === true,
    );
    expect(
      await runComponent<Customer>("public:getCustomerByUserId", { userId }),
    ).toBeNull();
  });

  test("replaces a customer that is deleted the day it was created", async () => {
    const userId = uniqueId("user");
    const getOrCreate = () =>
      runAsUser<{ customerId: string; isNew: boolean }>(
        "stripe:getOrCreateCustomer",
        {},
        userId,
      );

    const first = await getOrCreate();
    expect(first?.isNew).toBe(true);
    await stripe.customers.del(first!.customerId);
    await waitFor(
      () =>
        runComponent<Customer>("public:getCustomer", {
          stripeCustomerId: first!.customerId,
        }),
      (synced) => synced?.deleted === true,
    );

    // Stripe replays the first create for this user's idempotency key, so
    // the component has to notice the deleted customer and create another.
    const second = await getOrCreate();
    expect(second?.isNew).toBe(true);
    expect(second?.customerId).not.toBe(first!.customerId);
    const replacement = await stripe.customers.retrieve(second!.customerId);
    expect(replacement.deleted).toBeUndefined();
    expect(replacement.id).toBe(second!.customerId);

    await stripe.customers.del(second!.customerId);
  });
});
