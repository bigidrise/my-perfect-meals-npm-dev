---
name: OpenAI server runtime
description: Explicit upload shims and HTTP transport injection for isolated server-side OpenAI use.
---

Server-side OpenAI file uploads must use Node-compatible SDK shims or explicit Node-safe file construction, not a bare ambient `File` global.

**Why:** the installed SDK auto-initializes its web shim. A bare `new File(...)` in server code can therefore fail as `ReferenceError: File is not defined` in a runtime where that global is unavailable, before any provider response.

**How to apply:** make the Node runtime choice explicit before importing the SDK for server upload paths, and preserve safe diagnostics that identify local runtime failures separately from provider responses. When esbuild bundles an ESM server with OpenAI marked external, it can hoist OpenAI imports ahead of source-level shims; preload `openai/shims/node` with Node's `--import` flag in the production run command.

For offline SDK transport tests, inject the SDK's `fetch` option explicitly;
replacing the global fetch function alone is not a reliable network interceptor.

**Why:** The installed SDK's Node auto-shim can select its own fetch implementation.
A global interceptor was bypassed during an isolated opt-in-path test; a separate
TCP blockade prevented egress and exposed the incomplete interception.

**How to apply:** Supply a fake SDK transport and independently block network
connections when verifying paid-call wiring without charges. Do not treat a
patched global fetch or a synthetic API key alone as proof of isolation.