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
      handleCheckoutSessionCompleted: FunctionReference<
        "mutation",
        "internal",
        {
          metadata?: any;
          mode: string;
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
        { stripeCustomerId: string },
        null,
        Name
      >;
      handleCustomerUpdated: FunctionReference<
        "mutation",
        "internal",
        {
          email?: string;
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
      handleInvoicePaid: FunctionReference<
        "mutation",
        "internal",
        { amountPaid: number; stripeInvoiceId: string },
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
      handlePriceCreated: FunctionReference<
        "mutation",
        "internal",
        {
          active: boolean;
          billingScheme?: string;
          currency: string;
          description?: string;
          lookupKey?: string;
          metadata?: any;
          recurringInterval?: string;
          recurringIntervalCount?: number;
          stripePriceId: string;
          stripeProductId: string;
          tiers?: Array<{
            flatAmount?: number;
            unitAmount?: number;
            upTo: number | null;
          }>;
          tiersMode?: string;
          trialPeriodDays?: number;
          type: string;
          unitAmount?: number;
          usageType?: string;
        },
        null,
        Name
      >;
      handlePriceDeleted: FunctionReference<
        "mutation",
        "internal",
        { stripePriceId: string },
        null,
        Name
      >;
      handlePriceUpdated: FunctionReference<
        "mutation",
        "internal",
        {
          active: boolean;
          billingScheme?: string;
          currency: string;
          description?: string;
          lookupKey?: string;
          metadata?: any;
          recurringInterval?: string;
          recurringIntervalCount?: number;
          stripePriceId: string;
          stripeProductId: string;
          tiers?: Array<{
            flatAmount?: number;
            unitAmount?: number;
            upTo: number | null;
          }>;
          tiersMode?: string;
          trialPeriodDays?: number;
          type: string;
          unitAmount?: number;
          usageType?: string;
        },
        null,
        Name
      >;
      handleProductCreated: FunctionReference<
        "mutation",
        "internal",
        {
          active: boolean;
          defaultPriceId?: string;
          description?: string;
          images?: Array<string>;
          metadata?: any;
          name: string;
          stripeProductId: string;
          type?: string;
        },
        null,
        Name
      >;
      handleProductDeleted: FunctionReference<
        "mutation",
        "internal",
        { stripeProductId: string },
        null,
        Name
      >;
      handleProductUpdated: FunctionReference<
        "mutation",
        "internal",
        {
          active: boolean;
          defaultPriceId?: string;
          description?: string;
          images?: Array<string>;
          metadata?: any;
          name: string;
          stripeProductId: string;
          type?: string;
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
      listSubscriptionsWithCreationTime: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        Array<{
          _creationTime: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
        }>,
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
        { email: string },
        {
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
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        } | null,
        Name
      >;
      getPrice: FunctionReference<
        "query",
        "internal",
        { stripePriceId: string },
        {
          active: boolean;
          billingScheme?: string;
          currency: string;
          description?: string;
          lookupKey?: string;
          metadata?: any;
          recurringInterval?: string;
          recurringIntervalCount?: number;
          stripePriceId: string;
          stripeProductId: string;
          tiers?: Array<{
            flatAmount?: number;
            unitAmount?: number;
            upTo: number | null;
          }>;
          tiersMode?: string;
          trialPeriodDays?: number;
          type: string;
          unitAmount?: number;
          usageType?: string;
        } | null,
        Name
      >;
      getPriceByLookupKey: FunctionReference<
        "query",
        "internal",
        { lookupKey: string },
        {
          active: boolean;
          billingScheme?: string;
          currency: string;
          description?: string;
          lookupKey?: string;
          metadata?: any;
          recurringInterval?: string;
          recurringIntervalCount?: number;
          stripePriceId: string;
          stripeProductId: string;
          tiers?: Array<{
            flatAmount?: number;
            unitAmount?: number;
            upTo: number | null;
          }>;
          tiersMode?: string;
          trialPeriodDays?: number;
          type: string;
          unitAmount?: number;
          usageType?: string;
        } | null,
        Name
      >;
      getProduct: FunctionReference<
        "query",
        "internal",
        { stripeProductId: string },
        {
          active: boolean;
          defaultPriceId?: string;
          description?: string;
          images?: Array<string>;
          metadata?: any;
          name: string;
          stripeProductId: string;
          type?: string;
        } | null,
        Name
      >;
      getProductWithPrices: FunctionReference<
        "query",
        "internal",
        { stripeProductId: string },
        {
          prices: Array<{
            active: boolean;
            billingScheme?: string;
            currency: string;
            description?: string;
            lookupKey?: string;
            metadata?: any;
            recurringInterval?: string;
            recurringIntervalCount?: number;
            stripePriceId: string;
            stripeProductId: string;
            tiers?: Array<{
              flatAmount?: number;
              unitAmount?: number;
              upTo: number | null;
            }>;
            tiersMode?: string;
            trialPeriodDays?: number;
            type: string;
            unitAmount?: number;
            usageType?: string;
          }>;
          product: {
            active: boolean;
            defaultPriceId?: string;
            description?: string;
            images?: Array<string>;
            metadata?: any;
            name: string;
            stripeProductId: string;
            type?: string;
          };
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
      listActivePrices: FunctionReference<
        "query",
        "internal",
        {},
        Array<{
          active: boolean;
          billingScheme?: string;
          currency: string;
          description?: string;
          lookupKey?: string;
          metadata?: any;
          recurringInterval?: string;
          recurringIntervalCount?: number;
          stripePriceId: string;
          stripeProductId: string;
          tiers?: Array<{
            flatAmount?: number;
            unitAmount?: number;
            upTo: number | null;
          }>;
          tiersMode?: string;
          trialPeriodDays?: number;
          type: string;
          unitAmount?: number;
          usageType?: string;
        }>,
        Name
      >;
      listActivePricesByProduct: FunctionReference<
        "query",
        "internal",
        { stripeProductId: string },
        Array<{
          active: boolean;
          billingScheme?: string;
          currency: string;
          description?: string;
          lookupKey?: string;
          metadata?: any;
          recurringInterval?: string;
          recurringIntervalCount?: number;
          stripePriceId: string;
          stripeProductId: string;
          tiers?: Array<{
            flatAmount?: number;
            unitAmount?: number;
            upTo: number | null;
          }>;
          tiersMode?: string;
          trialPeriodDays?: number;
          type: string;
          unitAmount?: number;
          usageType?: string;
        }>,
        Name
      >;
      listActiveProducts: FunctionReference<
        "query",
        "internal",
        {},
        Array<{
          active: boolean;
          defaultPriceId?: string;
          description?: string;
          images?: Array<string>;
          metadata?: any;
          name: string;
          stripeProductId: string;
          type?: string;
        }>,
        Name
      >;
      listCheckoutSessions: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        Array<{
          metadata?: any;
          mode: string;
          status: string;
          stripeCheckoutSessionId: string;
          stripeCustomerId?: string;
        }>,
        Name
      >;
      listInvoices: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
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
        { orgId: string },
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
        { userId: string },
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
        { stripeCustomerId: string },
        Array<{
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
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
        { orgId: string },
        Array<{
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
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
        { userId: string },
        Array<{
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        }>,
        Name
      >;
      listPrices: FunctionReference<
        "query",
        "internal",
        {},
        Array<{
          active: boolean;
          billingScheme?: string;
          currency: string;
          description?: string;
          lookupKey?: string;
          metadata?: any;
          recurringInterval?: string;
          recurringIntervalCount?: number;
          stripePriceId: string;
          stripeProductId: string;
          tiers?: Array<{
            flatAmount?: number;
            unitAmount?: number;
            upTo: number | null;
          }>;
          tiersMode?: string;
          trialPeriodDays?: number;
          type: string;
          unitAmount?: number;
          usageType?: string;
        }>,
        Name
      >;
      listPricesByProduct: FunctionReference<
        "query",
        "internal",
        { stripeProductId: string },
        Array<{
          active: boolean;
          billingScheme?: string;
          currency: string;
          description?: string;
          lookupKey?: string;
          metadata?: any;
          recurringInterval?: string;
          recurringIntervalCount?: number;
          stripePriceId: string;
          stripeProductId: string;
          tiers?: Array<{
            flatAmount?: number;
            unitAmount?: number;
            upTo: number | null;
          }>;
          tiersMode?: string;
          trialPeriodDays?: number;
          type: string;
          unitAmount?: number;
          usageType?: string;
        }>,
        Name
      >;
      listProducts: FunctionReference<
        "query",
        "internal",
        {},
        Array<{
          active: boolean;
          defaultPriceId?: string;
          description?: string;
          images?: Array<string>;
          metadata?: any;
          name: string;
          stripeProductId: string;
          type?: string;
        }>,
        Name
      >;
      listSubscriptions: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
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
        { orgId: string },
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
        { userId: string },
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
          metadata: any;
          orgId?: string;
          stripeSubscriptionId: string;
          userId?: string;
        },
        null,
        Name
      >;
      updateSubscriptionQuantity: FunctionReference<
        "action",
        "internal",
        { quantity: number; stripeSubscriptionId: string },
        null,
        Name
      >;
    };
  };
