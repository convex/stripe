# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `@convex-dev/stripe`, a Convex component for integrating Stripe payments, subscriptions, and billing. It's published to npm and used as a dependency in Convex applications.

## Common Commands

```bash
# Development (runs backend, frontend example, and watch build concurrently)
npm run dev

# Build component
npm run build

# Run tests
npm run test

# Run single test file
npx vitest run src/client/index.test.ts

# Run tests in watch mode
npm run test:watch

# Type checking
npm run typecheck

# Linting
npm run lint

# Full validation before release
npm run preversion  # runs clean, ci, build, test, lint, typecheck
```

## Architecture

### Directory Structure

- `src/component/` - Convex component code that runs on Convex servers
  - `schema.ts` - Database schema (customers, subscriptions, payments, invoices, checkout_sessions)
  - `public.ts` - Public queries/mutations callable by app code
  - `private.ts` - Internal mutations for webhook event processing
  - `convex.config.ts` - Component configuration
- `src/client/` - Client SDK used by consuming applications
  - `index.ts` - `StripeSubscriptions` class and `registerRoutes` function
  - `types.ts` - TypeScript type definitions
- `src/react/` - React hooks (if any)
- `example/` - Example Convex application demonstrating usage
  - `convex/` - Example Convex functions using the component

### How It Works

1. **Component Pattern**: This is a Convex component - it exports a config (`convex.config.js`) that apps install via `app.use(stripe)` in their `convex.config.ts`
2. **Client SDK**: The `StripeSubscriptions` class wraps Stripe API calls and syncs data to the component's database
3. **Webhook Handler**: `registerRoutes()` sets up HTTP endpoint for Stripe webhooks, processes events, and stores data

### Key Exports

```typescript
// Main client class
import { StripeSubscriptions, registerRoutes } from "@convex-dev/stripe";

// Component config for convex.config.ts
import stripe from "@convex-dev/stripe/convex.config.js";
```

### Testing

Tests use `convex-test` framework. Test files are co-located with source (`.test.ts` suffix).

## Convex Guidelines

- Always use the new function syntax with `args`, `returns`, and `handler`
- Always include return validators (use `v.null()` for functions that return nothing)
- Use `internalQuery`/`internalMutation`/`internalAction` for private functions
- Never infer type "any" - use explicit types
- Always commit the `_generated` folder when using Convex
- Do NOT use `filter` in queries - use `withIndex` instead
