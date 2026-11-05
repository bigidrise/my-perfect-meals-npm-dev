---
name: Ask Chef test history isolation
description: Development smoke-test identity can also be used interactively; persistent test chats are not disposable.
---

The configured Development smoke-test account is also used for interactive
checks. Do not assume it is an isolated or disposable account.

**Why:** Fresh-conversation live tests left several open chats on that account.
The user cleared Ask Chef twice and each deletion exposed the next older chat,
making both successful deletions appear to fail.

**How to apply:** Use synthetic identities and rollback-backed fixtures for
database verification. Before any real generation test that persists a fresh
conversation, establish an isolation/cleanup plan that does not delete or hide
the user's existing history. Never create extra open conversations on an
interactive account merely to make test cases independent.
