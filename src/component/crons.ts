import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.js";

const crons = cronJobs();

crons.interval(
  "prune processed webhook events",
  { hours: 24 },
  internal.private.pruneWebhookEvents,
  {},
);

export default crons;
