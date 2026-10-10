<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working rules

Every task and feature ships with **unit tests and documentation**. A change isn't done without both.

- **Tests:** Vitest, next to the code as `src/**/*.test.ts`. Use the builders in `src/test/fixtures.ts`. Test server actions with `./store`, `./auth`, `./photos` and the `next/*` modules mocked (see `src/lib/actions.test.ts`). Keep logic that needs no DB in pure modules (e.g. `src/lib/locations.ts`, `src/lib/search.ts`) so it can be tested directly. `npm test`, `npx tsc --noEmit` and `npm run lint` must all pass.
- **Docs:** each feature has a page in `docs/` (purpose, admin/user behaviour, data model, code map, tests), linked from the README "Features" list. Update the README when setup, scripts or env vars change.
- **Schema changes** go in `src/lib/schema.sql` as idempotent statements (it is re-run by `npm run db:setup`). Note any deploy-order constraint in the feature doc.
