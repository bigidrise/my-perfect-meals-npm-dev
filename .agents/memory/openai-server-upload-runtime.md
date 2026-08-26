---
name: OpenAI server upload runtime
description: Avoid ambient web-global dependencies when sending server-side files to the OpenAI SDK.
---

Server-side OpenAI file uploads must use Node-compatible SDK shims or explicit Node-safe file construction, not a bare ambient `File` global.

**Why:** the installed SDK auto-initializes its web shim. A bare `new File(...)` in server code can therefore fail as `ReferenceError: File is not defined` in a runtime where that global is unavailable, before any provider response.

**How to apply:** make the Node runtime choice explicit before importing the SDK for server upload paths, and preserve safe diagnostics that identify local runtime failures separately from provider responses. When esbuild bundles an ESM server with OpenAI marked external, it can hoist OpenAI imports ahead of source-level shims; preload `openai/shims/node` with Node's `--import` flag in the production run command.