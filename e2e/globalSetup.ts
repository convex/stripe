import { execFile, spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    siteUrl: string;
    webhookSecret: string;
    stripeEnabled: boolean;
  }
}

const execFileAsync = promisify(execFile);
const LOCAL_WEBHOOK_SECRET = "whsec_e2e_local_signing_secret";

/**
 * Runs the example app and the component on a local Convex backend. With
 * STRIPE_E2E_SECRET_KEY set, also forwards the Stripe test account's webhooks
 * to it through `stripe listen`.
 */
export default async function setup(project: TestProject) {
  const stripeKey = process.env.STRIPE_E2E_SECRET_KEY || undefined;
  if (stripeKey && !/^(sk|rk)_test_/.test(stripeKey)) {
    throw new Error("STRIPE_E2E_SECRET_KEY must be a test-mode key");
  }

  const processes: ChildProcess[] = [];
  const stopAll = () => processes.forEach(stopProcessGroup);

  try {
    const convex = startProcess(
      "npx",
      [
        "convex",
        "dev",
        "--typecheck",
        "disable",
        "--codegen",
        "disable",
        "--tail-logs",
        "disable",
      ],
      { CONVEX_AGENT_MODE: "anonymous" },
    );
    processes.push(convex);
    await waitForOutput(convex, /Convex functions ready/, 180_000);
    const siteUrl = await readSiteUrl();

    let webhookSecret = LOCAL_WEBHOOK_SECRET;
    if (stripeKey) {
      const stripeEnv = { STRIPE_API_KEY: stripeKey };
      const { stdout } = await execFileAsync(
        "stripe",
        ["listen", "--print-secret"],
        { env: { ...process.env, ...stripeEnv } },
      );
      webhookSecret = stdout.trim();
      const listenArgs = [
        "listen",
        "--forward-to",
        `${siteUrl}/stripe/webhook`,
      ];
      if (process.env.STRIPE_E2E_LATEST_API_VERSION) {
        listenArgs.push("--latest");
      }
      const listener = startProcess("stripe", listenArgs, stripeEnv);
      processes.push(listener);
      // The listener's output includes its signing secret, so it is never
      // echoed on failure.
      await waitForOutput(listener, /Ready!/, 60_000, { quiet: true });
    }

    await setConvexEnv("STRIPE_WEBHOOK_SECRET", webhookSecret);
    await setConvexEnv("STRIPE_SECRET_KEY", stripeKey ?? "sk_test_e2e_unused");

    project.provide("siteUrl", siteUrl);
    project.provide("webhookSecret", webhookSecret);
    project.provide("stripeEnabled", Boolean(stripeKey));
  } catch (error) {
    stopAll();
    throw error;
  }

  return stopAll;
}

type OutputProcess = ChildProcess & { output: string[] };

function startProcess(
  command: string,
  args: string[],
  env: Record<string, string>,
): OutputProcess {
  // A separate process group lets teardown stop the local backend that
  // `convex dev` starts, not just the npx wrapper.
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  }) as OutputProcess;
  child.output = [];
  child.stdout?.on("data", (chunk) => child.output.push(String(chunk)));
  child.stderr?.on("data", (chunk) => child.output.push(String(chunk)));
  return child;
}

function stopProcessGroup(child: ChildProcess) {
  if (child.pid === undefined || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

function waitForOutput(
  child: OutputProcess,
  pattern: RegExp,
  timeoutMs: number,
  options: { quiet?: boolean } = {},
) {
  const name = child.spawnargs.slice(0, 3).join(" ");
  return new Promise<void>((resolve, reject) => {
    const fail = (reason: string) => {
      clearTimeout(timer);
      const output = options.quiet ? "" : `\n${child.output.join("")}`;
      reject(new Error(`${name} ${reason}${output}`));
    };
    const timer = setTimeout(
      () => fail(`did not become ready in ${timeoutMs}ms`),
      timeoutMs,
    );
    const check = () => {
      if (pattern.test(child.output.join(""))) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout?.on("data", check);
    child.stderr?.on("data", check);
    child.on("exit", (code) => fail(`exited with code ${code}`));
    check();
  });
}

async function readSiteUrl() {
  const envFile = await readFile(".env.local", "utf8");
  const match = envFile.match(/^VITE_CONVEX_SITE_URL=(.+)$/m);
  if (!match) {
    throw new Error("No VITE_CONVEX_SITE_URL in .env.local");
  }
  return match[1].trim();
}

function setConvexEnv(name: string, value: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("npx", ["convex", "env", "set", name], {
      stdio: ["pipe", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Setting ${name} failed: ${stderr}`)),
    );
    child.stdin.end(value);
  });
}
