<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Workspace Agent Directives

## Token & Credit Economy
- Never dump full file contents; use targeted diffs or inline modifications.
- Keep terminal output minimal. Filter verbose logs using pipe filters (e.g., `| Select-Object -First 20`).
- Provide concise explanations (1-3 bullet points max); skip conversational filler.

## Execution & Tool Boundaries
- Do not perform broad workspace-wide searches; inspect only relevant files in `./src` or explicit paths.
- Plan changes before editing. Outline the steps first, then wait or execute strictly as planned.
- Stop and report back if a command fails twice; do not trigger continuous auto-repair loops.
- Do not trigger browser testing or headless previews unless explicitly requested.
