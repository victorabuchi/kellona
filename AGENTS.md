<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Kellona rules

- Multi-tenant: every org-owned query goes through `orgScope(orgId)` in src/lib/tenant/scope.ts. Never call `db.orm` on an org-owned model directly outside that file and tests.
- Branding and customer names are data. No customer name may appear in code.
- 'use server' files export only async functions. Constants and types live in separate files.
- Never call redirect() inside a try block.
- Page files export only default, metadata/generateMetadata and route config.
- Format week/date params from local date parts, never toISOString().
- No em dashes in text or comments.
