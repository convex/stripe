/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    private: {
      claimWebhookEvent: FunctionReference<
        "mutation",
        "internal",
        { created: number; stripeEventId: string; type: string },
        "claimed" | "processed" | "in_progress",
        Name
      >;
      handleChargeRefunded: FunctionReference<
        "mutation",
        "internal",
        {
          amountRefunded: number;
          authoritative?: boolean;
          refunded: boolean;
          stripePaymentIntentId: string;
        },
        null,
        Name
      >;
      handleCheckoutSessionCompleted: FunctionReference<
        "mutation",
        "internal",
        {
          metadata?: any;
          mode: string;
          paymentStatus?: string;
          stripeCheckoutSessionId: string;
          stripeCustomerId?: string;
        },
        null,
        Name
      >;
      handleCustomerCreated: FunctionReference<
        "mutation",
        "internal",
        {
          email?: string;
          eventCreated?: number;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
        },
        null,
        Name
      >;
      handleCustomerDeleted: FunctionReference<
        "mutation",
        "internal",
        { eventCreated?: number; stripeCustomerId: string },
        null,
        Name
      >;
      handleCustomerUpdated: FunctionReference<
        "mutation",
        "internal",
        {
          email?: string;
          eventCreated?: number;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
        },
        null,
        Name
      >;
      handleInvoiceCreated: FunctionReference<
        "mutation",
        "internal",
        {
          amountDue: number;
          amountPaid: number;
          created: number;
          metadata?: any;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
        },
        null,
        Name
      >;
      handleInvoicePaymentFailed: FunctionReference<
        "mutation",
        "internal",
        { stripeInvoiceId: string },
        null,
        Name
      >;
      handlePaymentIntentSucceeded: FunctionReference<
        "mutation",
        "internal",
        {
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
        },
        null,
        Name
      >;
      handleSubscriptionCreated: FunctionReference<
        "mutation",
        "internal",
        {
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          eventCreated?: number;
          metadata?: any;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
        },
        null,
        Name
      >;
      handleSubscriptionDeleted: FunctionReference<
        "mutation",
        "internal",
        {
          cancelAt?: number;
          cancelAtPeriodEnd?: boolean;
          currentPeriodEnd?: number;
          eventCreated?: number;
          metadata?: any;
          priceId?: string;
          quantity?: number;
          stripeCustomerId?: string;
          stripeSubscriptionId: string;
        },
        null,
        Name
      >;
      handleSubscriptionUpdated: FunctionReference<
        "mutation",
        "internal",
        {
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          eventCreated?: number;
          metadata?: any;
          priceId?: string;
          quantity?: number;
          status: string;
          stripeCustomerId?: string;
          stripeSubscriptionId: string;
        },
        null,
        Name
      >;
      isWebhookEventProcessed: FunctionReference<
        "query",
        "internal",
        { stripeEventId: string },
        boolean,
        Name
      >;
      markWebhookEventProcessed: FunctionReference<
        "mutation",
        "internal",
        { created: number; stripeEventId: string; type: string },
        null,
        Name
      >;
      releaseWebhookEvent: FunctionReference<
        "mutation",
        "internal",
        { stripeEventId: string },
        null,
        Name
      >;
      updatePaymentCustomer: FunctionReference<
        "mutation",
        "internal",
        { stripeCustomerId: string; stripePaymentIntentId: string },
        null,
        Name
      >;
      updateSubscriptionQuantityInternal: FunctionReference<
        "mutation",
        "internal",
        { quantity: number; stripeSubscriptionId: string },
        null,
        Name
      >;
    };
    public: {
      createOrUpdateCustomer: FunctionReference<
        "mutation",
        "internal",
        {
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
        },
        string,
        Name
      >;
      getCheckoutSession: FunctionReference<
        "query",
        "internal",
        { stripeCheckoutSessionId: string },
        {
          metadata?: any;
          mode: string;
          paymentStatus?: string;
          status: string;
          stripeCheckoutSessionId: string;
          stripeCustomerId?: string;
        } | null,
        Name
      >;
      getCustomer: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        {
          deleted?: boolean;
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
          userId?: string;
        } | null,
        Name
      >;
      getCustomerByEmail: FunctionReference<
        "query",
        "internal",
        { email: string; unclaimed?: boolean },
        {
          deleted?: boolean;
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
          userId?: string;
        } | null,
        Name
      >;
      getCustomerByUserId: FunctionReference<
        "query",
        "internal",
        { userId: string },
        {
          deleted?: boolean;
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
          userId?: string;
        } | null,
        Name
      >;
      getPayment: FunctionReference<
        "query",
        "internal",
        { stripePaymentIntentId: string },
        {
          amount: number;
          amountRefunded?: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          refunded?: boolean;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        } | null,
        Name
      >;
      getSubscription: FunctionReference<
        "query",
        "internal",
        { stripeSubscriptionId: string },
        {
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        } | null,
        Name
      >;
      getSubscriptionByOrgId: FunctionReference<
        "query",
        "internal",
        { orgId: string },
        {
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        } | null,
        Name
      >;
      listCheckoutSessions: FunctionReference<
        "query",
        "internal",
        { limit?: number; stripeCustomerId: string },
        Array<{
          metadata?: any;
          mode: string;
          paymentStatus?: string;
          status: string;
          stripeCheckoutSessionId: string;
          stripeCustomerId?: string;
        }>,
        Name
      >;
      listInvoices: FunctionReference<
        "query",
        "internal",
        { limit?: number; stripeCustomerId: string },
        Array<{
          amountDue: number;
          amountPaid: number;
          created: number;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
          userId?: string;
        }>,
        Name
      >;
      listInvoicesByOrgId: FunctionReference<
        "query",
        "internal",
        { limit?: number; orgId: string },
        Array<{
          amountDue: number;
          amountPaid: number;
          created: number;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
          userId?: string;
        }>,
        Name
      >;
      listInvoicesByUserId: FunctionReference<
        "query",
        "internal",
        { limit?: number; userId: string },
        Array<{
          amountDue: number;
          amountPaid: number;
          created: number;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
          userId?: string;
        }>,
        Name
      >;
      listPayments: FunctionReference<
        "query",
        "internal",
        { limit?: number; stripeCustomerId: string },
        Array<{
          amount: number;
          amountRefunded?: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          refunded?: boolean;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        }>,
        Name
      >;
      listPaymentsByOrgId: FunctionReference<
        "query",
        "internal",
        { limit?: number; orgId: string },
        Array<{
          amount: number;
          amountRefunded?: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          refunded?: boolean;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        }>,
        Name
      >;
      listPaymentsByUserId: FunctionReference<
        "query",
        "internal",
        { limit?: number; userId: string },
        Array<{
          amount: number;
          amountRefunded?: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          refunded?: boolean;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        }>,
        Name
      >;
      listSubscriptions: FunctionReference<
        "query",
        "internal",
        { limit?: number; stripeCustomerId: string },
        Array<{
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        }>,
        Name
      >;
      listSubscriptionsByOrgId: FunctionReference<
        "query",
        "internal",
        { limit?: number; orgId: string },
        Array<{
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        }>,
        Name
      >;
      listSubscriptionsByUserId: FunctionReference<
        "query",
        "internal",
        { limit?: number; userId: string },
        Array<{
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        }>,
        Name
      >;
      updateSubscriptionMetadata: FunctionReference<
        "mutation",
        "internal",
        {
          metadata?: any;
          orgId?: string;
          stripeSubscriptionId: string;
          userId?: string;
        },
        null,
        Name
      >;
    };
  };
