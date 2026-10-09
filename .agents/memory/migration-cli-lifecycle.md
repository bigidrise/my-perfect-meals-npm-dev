---
name: One-off migration connection lifecycle
description: Why explicit migration commands must avoid importing the application database singleton.
---

Explicit one-off migration commands should own and close an isolated database connection rather than import the application database singleton.

**Why:** The application database module starts a recurring keepalive timer. Closing its pool does not end that timer, so successful migrations can appear to time out despite having committed.

**How to apply:** Use the project's verified TLS policy and bounded transactional migration helpers, but create a dedicated small connection pool for the command. Do not change the server's keepalive behavior to make a CLI exit.

Pass inline TypeScript through `tsx -e`, not bare standard input.

**Why:** In this workspace, bare `tsx` standard input was parsed as JavaScript and rejected TypeScript assertions before executing the command.

**How to apply:** For multiline inline commands, pass a quoted heredoc string to `tsx -e`. Exit successfully only after the outer async operation resolves; exiting inside `finally` can hide query failures.
