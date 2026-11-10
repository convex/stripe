import { execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
import StripeSDK from "stripe";
import { inject } from "vitest";

const execFileAsync = promisify(execFile);
const signer = new StripeSDK("sk_test_e2e_signer");

export type Customer = {
  stripeCustomerId: string;
  email?: string;
  name?: string;
  userId?: string;
  deleted?: boolean;
};

export type Subscription = {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  cancelAt?: number;
  priceId: string;
  userId?: string;
  orgId?: string;
};

export type Invoice = {
  stripeInvoiceId: string;
  stripeSubscriptionId?: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  userId?: string;
};

export type Payment = {
  stripePaymentIntentId: string;
  stripeCustomerId?: string;
  amount: number;
  amountRefunded?: number;
  refunded?: boolean;
  userId?: string;
};

/** Calls one of the component's public functions on the local deployment. */
export async function runComponent<T>(name: string, args: object = {}) {
  const { stdout } = await execFileAsync("npx", [
    "convex",
    "run",
    "--component",
    "stripe",
    name,
    JSON.stringify(args),
  ]);
  return parseResult<T>(stdout);
}

/** Calls an example app function as a signed-in user. */
export async function runAsUser<T>(name: string, args: object, userId: string) {
  const { stdout } = await execFileAsync("npx", [
    "convex",
    "run",
    name,
    JSON.stringify(args),
    "--identity",
    JSON.stringify({ subject: userId, tokenIdentifier: `e2e|${userId}` }),
  ]);
  return parseResult<T>(stdout);
}

function parseResult<T>(stdout: string): T | null {
  return stdout.trim() ? (JSON.parse(stdout) as T) : null;
}

export function uniqueId(prefix: string) {
  return `${prefix}_e2e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function stripeEvent(
  type: string,
  object: Record<string, unknown>,
  options: { id?: string; created?: number } = {},
) {
  return {
    id: options.id ?? uniqueId("evt"),
    object: "event",
    type,
    created: options.created ?? nowSeconds(),
    data: { object },
  };
}

/** Posts an event to the example app's webhook route. */
export async function deliver(
  event: object,
  options: { secret?: string; signed?: boolean } = {},
) {
  const payload = JSON.stringify(event);
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (options.signed !== false) {
    headers["stripe-signature"] =
      await signer.webhooks.generateTestHeaderStringAsync({
        payload,
        secret: options.secret ?? inject("webhookSecret"),
      });
  }
  return fetch(`${inject("siteUrl")}/stripe/webhook`, {
    method: "POST",
    headers,
    body: payload,
  });
}

/** Like Stripe, redelivers an event until the route accepts it. */
export async function deliverUntilAccepted(event: object, attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    const response = await deliver(event);
    if (response.ok || attempt === attempts) return response;
    await sleep(500 * attempt);
  }
}

export async function waitFor<T>(
  read: () => Promise<T>,
  isDone: (value: T) => boolean,
  timeoutMs = 60_000,
) {
  const deadline = Date.now() + timeoutMs;
  let value = await read();
  while (!isDone(value)) {
    if (Date.now() > deadline) {
      throw new Error(
        `Timed out waiting. Last value: ${JSON.stringify(value)}`,
      );
    }
    await sleep(1_000);
    value = await read();
  }
  return value;
}
