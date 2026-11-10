import type {
  HttpRouter,
  GenericActionCtx,
  GenericMutationCtx,
  GenericDataModel,
  GenericQueryCtx,
} from "convex/server";
import type Stripe from "stripe";
import type StripeSDK from "stripe";

// Type utils follow
type StripeClientConfig = ConstructorParameters<typeof StripeSDK>[1];
export type StripeApiVersion =
  | NonNullable<StripeClientConfig>["apiVersion"]
  | (string & {})
  | null;

/**
 * Arguments for `StripeSubscriptions.createCheckoutSession`. Setup mode saves a
 * payment method without charging, so it takes no price.
 */
export type CreateCheckoutSessionArgs = {
  customerId?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  /** Metadata to attach to the subscription (only for mode: "subscription") */
  subscriptionMetadata?: Record<string, string>;
  /** Metadata to attach to the payment intent (only for mode: "payment") */
  paymentIntentMetadata?: Record<string, string>;
  /** Additional Stripe Checkout Session parameters passed through to the API */
  params?: Partial<StripeSDK.Checkout.SessionCreateParams>;
} & (
  | { mode: "payment" | "subscription"; priceId: string; quantity?: number }
  | { mode: "setup"; priceId?: never; quantity?: never }
);

export type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;
export type MutationCtx = Pick<
  GenericMutationCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;
export type ActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runQuery" | "runMutation" | "runAction"
>;

// Webhook Event Handler Types

/**
 * Handler function for a specific Stripe webhook event.
 * Receives the action context and the full Stripe event object.
 */
export type StripeEventHandler<
  T extends Stripe.Event.Type = Stripe.Event.Type,
> = (
  ctx: GenericActionCtx<GenericDataModel>,
  event: Stripe.Event & { type: T },
) => Promise<void>;

/**
 * Map of event types to their handlers.
 * Users can provide handlers for any Stripe webhook event type.
 */
export type StripeEventHandlers = {
  [K in Stripe.Event.Type]?: StripeEventHandler<K>;
};

/**
 * Where a webhook request failed. `event` is only present once the request's
 * signature has been verified.
 */
export type StripeWebhookErrorDetails = {
  stage: "signature" | "processing";
  event?: Stripe.Event;
};

/**
 * Configuration for webhook registration.
 */
export type RegisterRoutesConfig = {
  /**
   * Optional webhook path. Defaults to "/stripe/webhook"
   */
  webhookPath?: string;

  /**
   * Optional event handlers that run after default processing.
   * The component will handle database syncing automatically,
   * and then call your custom handlers.
   */
  events?: StripeEventHandlers;

  /**
   * Optional generic event handler that runs for all events.
   * This runs after default processing and before specific event handlers.
   */
  onEvent?: StripeEventHandler;

  /**
   * Optional callback for webhook failures. The component only logs a fixed
   * message (plus the event ID and type once verified) because errors can
   * carry the raw payload, signature header, or customer fields. Use this to
   * send the underlying error to your own logging or monitoring.
   */
  onError?: (
    ctx: GenericActionCtx<GenericDataModel>,
    error: unknown,
    details: StripeWebhookErrorDetails,
  ) => void | Promise<void>;

  /**
   * Skip events whose ID the component has already processed. Defaults to
   * true. Resending an event from the Stripe Dashboard or CLI reuses its ID,
   * so set this to false while you replay events you want handled again. When
   * false, the route neither checks nor records event IDs.
   */
  deduplicateEvents?: boolean;

  /**
   * Stripe webhook secret for signature verification.
   * Defaults to process.env.STRIPE_WEBHOOK_SECRET
   */
  STRIPE_WEBHOOK_SECRET?: string;

  /**
   * Stripe secret key for API calls.
   * Defaults to process.env.STRIPE_SECRET_KEY
   */
  STRIPE_SECRET_KEY?: string;

  /**
   * Optional Stripe API version for the webhook Stripe client.
   * Defaults to the API version bundled with the installed Stripe SDK.
   */
  apiVersion?: StripeApiVersion;
};

/**
 * Type for the HttpRouter to be used in registerRoutes
 */
export type { HttpRouter };
