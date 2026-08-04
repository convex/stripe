import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api.js";
import schema from "./schema.js";
import { modules } from "./setup.test.js";

test("customer creation and retrieval", async () => {
  const t = convexTest(schema, modules);

  // Create a customer
  const customerId = await t.mutation(api.public.createOrUpdateCustomer, {
    stripeCustomerId: "cus_test123",
    email: "test@example.com",
    name: "Test User",
    metadata: { userId: "user_123" },
  });

  expect(customerId).toBeDefined();

  // Retrieve the customer
  const customer = await t.query(api.public.getCustomer, {
    stripeCustomerId: "cus_test123",
  });

  expect(customer).toBeDefined();
  expect(customer?.email).toBe("test@example.com");
  expect(customer?.name).toBe("Test User");
  expect(customer?.metadata).toEqual({ userId: "user_123" });
});

test("customer update", async () => {
  const t = convexTest(schema, modules);

  // Create initial customer
  await t.mutation(api.public.createOrUpdateCustomer, {
    stripeCustomerId: "cus_test456",
    email: "old@example.com",
    name: "Old Name",
  });

  // Update customer
  await t.mutation(api.public.createOrUpdateCustomer, {
    stripeCustomerId: "cus_test456",
    email: "new@example.com",
    name: "New Name",
    metadata: { updated: true },
  });

  // Verify update
  const customer = await t.query(api.public.getCustomer, {
    stripeCustomerId: "cus_test456",
  });

  expect(customer?.email).toBe("new@example.com");
  expect(customer?.name).toBe("New Name");
  expect(customer?.metadata).toEqual({ updated: true });
});

test("subscription creation via webhook", async () => {
  const t = convexTest(schema, modules);

  // Create customer first
  await t.mutation(api.private.handleCustomerCreated, {
    stripeCustomerId: "cus_test789",
    email: "customer@example.com",
    name: "Customer Name",
  });

  // Create subscription via webhook
  await t.mutation(api.private.handleSubscriptionCreated, {
    stripeSubscriptionId: "sub_test123",
    stripeCustomerId: "cus_test789",
    status: "active",
    currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    cancelAtPeriodEnd: false,
    quantity: 5,
    priceId: "price_test",
    metadata: { orgId: "org_123" },
  });

  // Retrieve subscription
  const subscription = await t.query(api.public.getSubscription, {
    stripeSubscriptionId: "sub_test123",
  });

  expect(subscription).toBeDefined();
  expect(subscription?.status).toBe("active");
  expect(subscription?.quantity).toBe(5);
  expect(subscription?.metadata).toEqual({ orgId: "org_123" });
});

test("list subscriptions for customer", async () => {
  const t = convexTest(schema, modules);

  // Create customer
  await t.mutation(api.private.handleCustomerCreated, {
    stripeCustomerId: "cus_multi",
    email: "multi@example.com",
  });

  // Create multiple subscriptions
  await t.mutation(api.private.handleSubscriptionCreated, {
    stripeSubscriptionId: "sub_1",
    stripeCustomerId: "cus_multi",
    status: "active",
    currentPeriodEnd: Date.now(),
    cancelAtPeriodEnd: false,
    priceId: "price_1",
  });

  await t.mutation(api.private.handleSubscriptionCreated, {
    stripeSubscriptionId: "sub_2",
    stripeCustomerId: "cus_multi",
    status: "active",
    currentPeriodEnd: Date.now(),
    cancelAtPeriodEnd: false,
    priceId: "price_2",
  });

  // List subscriptions
  const subscriptions = await t.query(api.public.listSubscriptions, {
    stripeCustomerId: "cus_multi",
  });

  expect(subscriptions).toHaveLength(2);
  expect(subscriptions.map((s: any) => s.stripeSubscriptionId)).toContain(
    "sub_1",
  );
  expect(subscriptions.map((s: any) => s.stripeSubscriptionId)).toContain(
    "sub_2",
  );
});

test("update subscription metadata for custom lookups", async () => {
  const t = convexTest(schema, modules);

  // Create subscription
  await t.mutation(api.private.handleSubscriptionCreated, {
    stripeSubscriptionId: "sub_metadata",
    stripeCustomerId: "cus_test",
    status: "active",
    currentPeriodEnd: Date.now(),
    cancelAtPeriodEnd: false,
    priceId: "price_test",
  });

  // Update metadata
  await t.mutation(api.public.updateSubscriptionMetadata, {
    stripeSubscriptionId: "sub_metadata",
    metadata: {
      orgId: "org_456",
      userId: "user_789",
      plan: "pro",
    },
  });

  // Verify metadata
  const subscription = await t.query(api.public.getSubscription, {
    stripeSubscriptionId: "sub_metadata",
  });

  expect(subscription?.metadata).toEqual({
    orgId: "org_456",
    userId: "user_789",
    plan: "pro",
  });
});

test("subscription status update via webhook", async () => {
  const t = convexTest(schema, modules);

  // Create initial subscription
  await t.mutation(api.private.handleSubscriptionCreated, {
    stripeSubscriptionId: "sub_status",
    stripeCustomerId: "cus_test",
    status: "active",
    currentPeriodEnd: Date.now(),
    cancelAtPeriodEnd: false,
    priceId: "price_test",
  });

  // Update status to past_due
  await t.mutation(api.private.handleSubscriptionUpdated, {
    stripeSubscriptionId: "sub_status",
    status: "past_due",
    currentPeriodEnd: Date.now(),
    cancelAtPeriodEnd: false,
  });

  // Verify status update
  const subscription = await t.query(api.public.getSubscription, {
    stripeSubscriptionId: "sub_status",
  });

  expect(subscription?.status).toBe("past_due");
});

test("subscription plan change updates priceId", async () => {
  const t = convexTest(schema, modules);

  await t.mutation(api.private.handleSubscriptionCreated, {
    stripeSubscriptionId: "sub_plan_change",
    stripeCustomerId: "cus_test",
    status: "active",
    currentPeriodEnd: Date.now(),
    cancelAtPeriodEnd: false,
    priceId: "price_old",
  });

  await t.mutation(api.private.handleSubscriptionUpdated, {
    stripeSubscriptionId: "sub_plan_change",
    status: "active",
    currentPeriodEnd: Date.now(),
    cancelAtPeriodEnd: false,
    priceId: "price_new",
  });

  const subscription = await t.query(api.public.getSubscription, {
    stripeSubscriptionId: "sub_plan_change",
  });

  expect(subscription?.priceId).toBe("price_new");
});

test("subscription cancel_at sets cancelAtPeriodEnd when it matches currentPeriodEnd", async () => {
  const t = convexTest(schema, modules);

  const currentPeriodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  await t.mutation(api.private.handleSubscriptionCreated, {
    stripeSubscriptionId: "sub_cancel_at",
    stripeCustomerId: "cus_test",
    status: "active",
    currentPeriodEnd,
    cancelAtPeriodEnd: false,
    priceId: "price_test",
  });

  // Some Stripe flows set `cancel_at` but leave `cancel_at_period_end` false.
  await t.mutation(api.private.handleSubscriptionUpdated, {
    stripeSubscriptionId: "sub_cancel_at",
    status: "active",
    currentPeriodEnd,
    cancelAtPeriodEnd: false,
    cancelAt: currentPeriodEnd,
  });

  const subscription = await t.query(api.public.getSubscription, {
    stripeSubscriptionId: "sub_cancel_at",
  });

  expect(subscription?.cancelAtPeriodEnd).toBe(true);
  expect(subscription?.cancelAt).toBe(currentPeriodEnd);
});

test("seat quantity update", async () => {
  const t = convexTest(schema, modules);

  // Create subscription with initial quantity
  await t.mutation(api.private.handleSubscriptionCreated, {
    stripeSubscriptionId: "sub_seats",
    stripeCustomerId: "cus_test",
    status: "active",
    currentPeriodEnd: Date.now(),
    cancelAtPeriodEnd: false,
    quantity: 5,
    priceId: "price_test",
  });

  // Update quantity
  await t.mutation(api.private.handleSubscriptionUpdated, {
    stripeSubscriptionId: "sub_seats",
    status: "active",
    currentPeriodEnd: Date.now(),
    cancelAtPeriodEnd: false,
    quantity: 10,
  });

  // Verify quantity update
  const subscription = await t.query(api.public.getSubscription, {
    stripeSubscriptionId: "sub_seats",
  });

  expect(subscription?.quantity).toBe(10);
});

// ============================================================================
// PAYMENT TESTS
// ============================================================================

test("payment creation via payment_intent.succeeded webhook", async () => {
  const t = convexTest(schema, modules);

  // Simulate payment_intent.succeeded webhook
  await t.mutation(api.private.handlePaymentIntentSucceeded, {
    stripePaymentIntentId: "pi_test123",
    stripeCustomerId: "cus_payment_test",
    amount: 1999, // $19.99
    currency: "usd",
    status: "succeeded",
    created: Date.now(),
    metadata: { orderId: "order_123" },
  });

  // Retrieve the payment
  const payment = await t.query(api.public.getPayment, {
    stripePaymentIntentId: "pi_test123",
  });

  expect(payment).toBeDefined();
  expect(payment?.amount).toBe(1999);
  expect(payment?.currency).toBe("usd");
  expect(payment?.status).toBe("succeeded");
  expect(payment?.stripeCustomerId).toBe("cus_payment_test");
  expect(payment?.metadata).toEqual({ orderId: "order_123" });
});

test("payment without customer (guest checkout)", async () => {
  const t = convexTest(schema, modules);

  // Create payment without customer ID (guest checkout)
  await t.mutation(api.private.handlePaymentIntentSucceeded, {
    stripePaymentIntentId: "pi_guest123",
    amount: 2500,
    currency: "usd",
    status: "succeeded",
    created: Date.now(),
    metadata: {},
  });

  const payment = await t.query(api.public.getPayment, {
    stripePaymentIntentId: "pi_guest123",
  });

  expect(payment).toBeDefined();
  expect(payment?.stripeCustomerId).toBeUndefined();
});

test("payment with orgId and userId extraction from metadata", async () => {
  const t = convexTest(schema, modules);

  // Create payment with orgId and userId in metadata
  await t.mutation(api.private.handlePaymentIntentSucceeded, {
    stripePaymentIntentId: "pi_org123",
    stripeCustomerId: "cus_org_test",
    amount: 5000,
    currency: "usd",
    status: "succeeded",
    created: Date.now(),
    metadata: {
      orgId: "org_demo_123",
      userId: "user_demo_456",
      customField: "custom_value",
    },
  });

  const payment = await t.query(api.public.getPayment, {
    stripePaymentIntentId: "pi_org123",
  });

  expect(payment?.orgId).toBe("org_demo_123");
  expect(payment?.userId).toBe("user_demo_456");
  expect(payment?.metadata).toEqual({
    orgId: "org_demo_123",
    userId: "user_demo_456",
    customField: "custom_value",
  });
});

test("subscription update upserts when created webhook is missing", async () => {
  const t = convexTest(schema, modules);

  await t.mutation(api.private.handleSubscriptionUpdated as any, {
    stripeSubscriptionId: "sub_update_first",
    stripeCustomerId: "cus_update_first",
    status: "active",
    currentPeriodEnd: 1_800_000_000,
    cancelAtPeriodEnd: false,
    quantity: 4,
    priceId: "price_update_first",
    metadata: { userId: "user_update_first", orgId: "org_update_first" },
  });

  const subscription = await t.query(api.public.getSubscription, {
    stripeSubscriptionId: "sub_update_first",
  });

  expect(subscription).toMatchObject({
    stripeSubscriptionId: "sub_update_first",
    stripeCustomerId: "cus_update_first",
    status: "active",
    currentPeriodEnd: 1_800_000_000,
    quantity: 4,
    priceId: "price_update_first",
    userId: "user_update_first",
    orgId: "org_update_first",
  });
});

test("invoice creation updates existing invoices and mirrors invoice metadata", async () => {
  const t = convexTest(schema, modules);

  await t.mutation(api.private.handleInvoiceCreated, {
    stripeInvoiceId: "in_upsert",
    stripeCustomerId: "cus_invoice_upsert",
    status: "draft",
    amountDue: 1000,
    amountPaid: 0,
    created: 1_700_000_000,
    metadata: { userId: "user_initial", orgId: "org_initial" },
  } as any);

  await t.mutation(api.private.handleInvoiceCreated, {
    stripeInvoiceId: "in_upsert",
    stripeCustomerId: "cus_invoice_upsert",
    status: "open",
    amountDue: 1500,
    amountPaid: 500,
    created: 1_700_000_000,
    metadata: { userId: "user_invoice_meta", orgId: "org_invoice_meta" },
  } as any);

  const invoices = await t.query(api.public.listInvoicesByOrgId, {
    orgId: "org_invoice_meta",
  });

  expect(invoices).toHaveLength(1);
  expect(invoices[0]).toMatchObject({
    stripeInvoiceId: "in_upsert",
    status: "open",
    amountDue: 1500,
    amountPaid: 500,
    userId: "user_invoice_meta",
    orgId: "org_invoice_meta",
    metadata: { userId: "user_invoice_meta", orgId: "org_invoice_meta" },
  });
});

test("invoice update can mirror metadata changes", async () => {
  const t = convexTest(schema, modules);

  await t.mutation(api.private.handleInvoiceCreated, {
    stripeInvoiceId: "in_metadata_update",
    stripeCustomerId: "cus_metadata_update",
    status: "open",
    amountDue: 1000,
    amountPaid: 0,
    created: 1_700_000_000,
    metadata: { userId: "user_old" },
  } as any);

  await t.mutation(api.private.handleInvoiceCreated, {
    stripeInvoiceId: "in_metadata_update",
    stripeCustomerId: "cus_metadata_update",
    status: "open",
    amountDue: 1000,
    amountPaid: 0,
    created: 1_700_000_000,
    metadata: { userId: "user_new", orgId: "org_new" },
  } as any);

  const invoices = await t.query(api.public.listInvoicesByOrgId, {
    orgId: "org_new",
  });

  expect(invoices).toHaveLength(1);
  expect(invoices[0].metadata).toEqual({
    userId: "user_new",
    orgId: "org_new",
  });
});

test("delayed invoice.created does not downgrade finalized invoice status", async () => {
  const t = convexTest(schema, modules);

  await t.mutation(api.private.handleInvoiceCreated, {
    stripeInvoiceId: "in_out_of_order",
    stripeCustomerId: "cus_out_of_order",
    status: "open",
    amountDue: 1500,
    amountPaid: 0,
    created: 1_700_000_000,
  });

  await t.mutation(api.private.handleInvoiceCreated, {
    stripeInvoiceId: "in_out_of_order",
    stripeCustomerId: "cus_out_of_order",
    status: "draft",
    amountDue: 1500,
    amountPaid: 0,
    created: 1_700_000_000,
  });

  const invoices = await t.query(api.public.listInvoices, {
    stripeCustomerId: "cus_out_of_order",
  });

  expect(invoices).toHaveLength(1);
  expect(invoices[0].status).toBe("open");
});

test("delayed invoice.created does not overwrite paid invoice amounts", async () => {
  const t = convexTest(schema, modules);

  await t.mutation(api.private.handleInvoiceCreated, {
    stripeInvoiceId: "in_paid_out_of_order",
    stripeCustomerId: "cus_paid_out_of_order",
    status: "paid",
    amountDue: 1500,
    amountPaid: 1500,
    created: 1_700_000_100,
  });

  await t.mutation(api.private.handleInvoiceCreated, {
    stripeInvoiceId: "in_paid_out_of_order",
    stripeCustomerId: "cus_paid_out_of_order",
    status: "draft",
    amountDue: 1500,
    amountPaid: 0,
    created: 1_700_000_000,
  });

  const invoices = await t.query(api.public.listInvoices, {
    stripeCustomerId: "cus_paid_out_of_order",
  });

  expect(invoices).toHaveLength(1);
  expect(invoices[0]).toMatchObject({
    status: "paid",
    amountDue: 1500,
    amountPaid: 1500,
    created: 1_700_000_100,
  });
});

test("delayed invoice.payment_failed does not downgrade paid invoice", async () => {
  const t = convexTest(schema, modules);

  await t.mutation(api.private.handleInvoiceCreated, {
    stripeInvoiceId: "in_paid_then_failed",
    stripeCustomerId: "cus_paid_then_failed",
    status: "paid",
    amountDue: 1500,
    amountPaid: 1500,
    created: 1_700_000_100,
  });

  await t.mutation(api.private.handleInvoicePaymentFailed, {
    stripeInvoiceId: "in_paid_then_failed",
  });

  const invoices = await t.query(api.public.listInvoices, {
    stripeCustomerId: "cus_paid_then_failed",
  });

  expect(invoices).toHaveLength(1);
  expect(invoices[0].status).toBe("paid");
});

test("customer deletion scrubs PII but preserves linkage", async () => {
  const t = convexTest(schema, modules);

  await t.mutation(api.private.handleCustomerCreated, {
    stripeCustomerId: "cus_delete",
    email: "delete@example.com",
    name: "Delete Me",
    metadata: { userId: "user_delete", tier: "pro" },
  });

  await t.mutation((api.private as any).handleCustomerDeleted, {
    stripeCustomerId: "cus_delete",
  });

  const customer = await t.query(api.public.getCustomer, {
    stripeCustomerId: "cus_delete",
  });

  expect(customer).toMatchObject({
    stripeCustomerId: "cus_delete",
    userId: "user_delete",
    metadata: {},
  });
  expect(customer?.email).toBeUndefined();
  expect(customer?.name).toBeUndefined();
});

test("list payments by customer ID", async () => {
  const t = convexTest(schema, modules);

  // Create multiple payments for the same customer
  await t.mutation(api.private.handlePaymentIntentSucceeded, {
    stripePaymentIntentId: "pi_cust1",
    stripeCustomerId: "cus_multi_test",
    amount: 1000,
    currency: "usd",
    status: "succeeded",
    created: Date.now(),
    metadata: {},
  });

  await t.mutation(api.private.handlePaymentIntentSucceeded, {
    stripePaymentIntentId: "pi_cust2",
    stripeCustomerId: "cus_multi_test",
    amount: 2000,
    currency: "usd",
    status: "succeeded",
    created: Date.now(),
    metadata: {},
  });

  await t.mutation(api.private.handlePaymentIntentSucceeded, {
    stripePaymentIntentId: "pi_other",
    stripeCustomerId: "cus_other",
    amount: 3000,
    currency: "usd",
    status: "succeeded",
    created: Date.now(),
    metadata: {},
  });

  // List payments for the specific customer
  const payments = await t.query(api.public.listPayments, {
    stripeCustomerId: "cus_multi_test",
  });

  expect(payments).toHaveLength(2);
  expect(payments?.map((p: any) => p.stripePaymentIntentId)).toContain(
    "pi_cust1",
  );
  expect(payments?.map((p: any) => p.stripePaymentIntentId)).toContain(
    "pi_cust2",
  );
});

test("list payments by user ID", async () => {
  const t = convexTest(schema, modules);

  // Create payments with different user IDs
  await t.mutation(api.private.handlePaymentIntentSucceeded, {
    stripePaymentIntentId: "pi_user1",
    stripeCustomerId: "cus_test",
    amount: 1500,
    currency: "usd",
    status: "succeeded",
    created: Date.now(),
    metadata: { userId: "user_alice" },
  });

  await t.mutation(api.private.handlePaymentIntentSucceeded, {
    stripePaymentIntentId: "pi_user2",
    stripeCustomerId: "cus_test",
    amount: 2500,
    currency: "usd",
    status: "succeeded",
    created: Date.now(),
    metadata: { userId: "user_alice" },
  });

  await t.mutation(api.private.handlePaymentIntentSucceeded, {
    stripePaymentIntentId: "pi_user3",
    stripeCustomerId: "cus_test2",
    amount: 3500,
    currency: "usd",
    status: "succeeded",
    created: Date.now(),
    metadata: { userId: "user_bob" },
  });

  // List payments for user_alice
  const alicePayments = await t.query(api.public.listPaymentsByUserId, {
    userId: "user_alice",
  });

  expect(alicePayments).toHaveLength(2);
  expect(alicePayments?.every((p: any) => p.userId === "user_alice")).toBe(
    true,
  );
});

test("list payments by org ID", async () => {
  const t = convexTest(schema, modules);

  // Create payments with different org IDs
  await t.mutation(api.private.handlePaymentIntentSucceeded, {
    stripePaymentIntentId: "pi_org1",
    stripeCustomerId: "cus_test",
    amount: 1500,
    currency: "usd",
    status: "succeeded",
    created: Date.now(),
    metadata: { orgId: "org_acme" },
  });

  await t.mutation(api.private.handlePaymentIntentSucceeded, {
    stripePaymentIntentId: "pi_org2",
    stripeCustomerId: "cus_test",
    amount: 2500,
    currency: "usd",
    status: "succeeded",
    created: Date.now(),
    metadata: { orgId: "org_acme" },
  });

  await t.mutation(api.private.handlePaymentIntentSucceeded, {
    stripePaymentIntentId: "pi_org3",
    stripeCustomerId: "cus_test2",
    amount: 3500,
    currency: "usd",
    status: "succeeded",
    created: Date.now(),
    metadata: { orgId: "org_other" },
  });

  // List payments for org_acme
  const acmePayments = await t.query(api.public.listPaymentsByOrgId, {
    orgId: "org_acme",
  });

  expect(acmePayments).toHaveLength(2);
  expect(acmePayments?.every((p: any) => p.orgId === "org_acme")).toBe(true);
});

test("automatic customer linking - webhook timing fix", async () => {
  const t = convexTest(schema, modules);

  // Step 1: payment_intent.succeeded fires first (without customer)
  await t.mutation(api.private.handlePaymentIntentSucceeded, {
    stripePaymentIntentId: "pi_timing_test",
    amount: 4999,
    currency: "usd",
    status: "succeeded",
    created: Date.now(),
    metadata: { orderId: "order_timing" },
  });

  // Verify payment exists without customer
  let payment = await t.query(api.public.getPayment, {
    stripePaymentIntentId: "pi_timing_test",
  });

  expect(payment).toBeDefined();
  expect(payment?.stripeCustomerId).toBeUndefined();

  // Step 2: checkout.session.completed fires later with customer ID
  await t.mutation(api.private.updatePaymentCustomer, {
    stripePaymentIntentId: "pi_timing_test",
    stripeCustomerId: "cus_timing_test",
  });

  // Verify payment now has customer ID
  payment = await t.query(api.public.getPayment, {
    stripePaymentIntentId: "pi_timing_test",
  });

  expect(payment?.stripeCustomerId).toBe("cus_timing_test");
  expect(payment?.amount).toBe(4999); // Other fields unchanged
});

test("updatePaymentCustomer does not overwrite existing customer", async () => {
  const t = convexTest(schema, modules);

  // Create payment with customer ID
  await t.mutation(api.private.handlePaymentIntentSucceeded, {
    stripePaymentIntentId: "pi_no_overwrite",
    stripeCustomerId: "cus_original",
    amount: 3000,
    currency: "usd",
    status: "succeeded",
    created: Date.now(),
    metadata: {},
  });

  // Try to update with different customer ID (should not change)
  await t.mutation(api.private.updatePaymentCustomer, {
    stripePaymentIntentId: "pi_no_overwrite",
    stripeCustomerId: "cus_different",
  });

  // Verify original customer ID is preserved
  const payment = await t.query(api.public.getPayment, {
    stripePaymentIntentId: "pi_no_overwrite",
  });

  expect(payment?.stripeCustomerId).toBe("cus_original");
});

test("handlePaymentIntentSucceeded updates existing payment with customer", async () => {
  const t = convexTest(schema, modules);

  // Create payment without customer
  await t.mutation(api.private.handlePaymentIntentSucceeded, {
    stripePaymentIntentId: "pi_update_test",
    amount: 5500,
    currency: "eur",
    status: "succeeded",
    created: Date.now(),
    metadata: {},
  });

  // Same webhook fires again with customer (idempotency)
  await t.mutation(api.private.handlePaymentIntentSucceeded, {
    stripePaymentIntentId: "pi_update_test",
    stripeCustomerId: "cus_idempotent",
    amount: 5500,
    currency: "eur",
    status: "succeeded",
    created: Date.now(),
    metadata: {},
  });

  const payment = await t.query(api.public.getPayment, {
    stripePaymentIntentId: "pi_update_test",
  });

  expect(payment?.stripeCustomerId).toBe("cus_idempotent");
});

test("a stale subscription update cannot resurrect a cancelled subscription", async () => {
  const t = convexTest(schema, modules);

  await t.mutation(api.private.handleCustomerCreated, {
    stripeCustomerId: "cus_reorder",
    email: "reorder@example.com",
  });

  await t.mutation(api.private.handleSubscriptionCreated, {
    stripeSubscriptionId: "sub_reorder",
    stripeCustomerId: "cus_reorder",
    status: "active",
    currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
    cancelAtPeriodEnd: false,
    priceId: "price_reorder",
  });

  await t.mutation(api.private.handleSubscriptionDeleted, {
    stripeSubscriptionId: "sub_reorder",
  });

  // Stripe does not guarantee webhook ordering and retries failed deliveries
  // for up to three days, so an older `customer.subscription.updated` can be
  // delivered after `customer.subscription.deleted`. Applying it would restore
  // access to somebody who has cancelled.
  await t.mutation(api.private.handleSubscriptionUpdated, {
    stripeSubscriptionId: "sub_reorder",
    stripeCustomerId: "cus_reorder",
    status: "active",
    currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
    cancelAtPeriodEnd: false,
    priceId: "price_reorder",
  });

  const subscription = await t.query(api.public.getSubscription, {
    stripeSubscriptionId: "sub_reorder",
  });

  expect(subscription?.status).toBe("canceled");
});

test("a cancelled subscription still accepts a canceled update", async () => {
  const t = convexTest(schema, modules);

  await t.mutation(api.private.handleCustomerCreated, {
    stripeCustomerId: "cus_recancel",
    email: "recancel@example.com",
  });

  await t.mutation(api.private.handleSubscriptionCreated, {
    stripeSubscriptionId: "sub_recancel",
    stripeCustomerId: "cus_recancel",
    status: "active",
    currentPeriodEnd: Date.now(),
    cancelAtPeriodEnd: false,
    priceId: "price_recancel",
  });

  await t.mutation(api.private.handleSubscriptionDeleted, {
    stripeSubscriptionId: "sub_recancel",
  });

  // The guard is on resurrection only: a redelivered `canceled` update must
  // still be able to refresh the row's other fields.
  await t.mutation(api.private.handleSubscriptionUpdated, {
    stripeSubscriptionId: "sub_recancel",
    stripeCustomerId: "cus_recancel",
    status: "canceled",
    currentPeriodEnd: Date.now(),
    cancelAtPeriodEnd: true,
    quantity: 3,
    priceId: "price_recancel",
  });

  const subscription = await t.query(api.public.getSubscription, {
    stripeSubscriptionId: "sub_recancel",
  });

  expect(subscription?.status).toBe("canceled");
  expect(subscription?.quantity).toBe(3);
});
