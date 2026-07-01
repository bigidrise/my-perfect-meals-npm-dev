---
name: otplib v12 ESM API
description: How to correctly import and instantiate TOTP from otplib v12 in ESM/tsx — requires instantiated plugins, not the legacy authenticator export.
---

# otplib v12 ESM API

## The rule
Do NOT use `import { authenticator } from "otplib"` — that export does not exist in v12 ESM. Use the `TOTP` class with instantiated plugins.

**Why:** otplib v12 restructured its ESM exports. The `authenticator` singleton is not exported. Instead, you construct a `TOTP` instance with explicit `crypto` and `base32` plugins. Both `generate()` and `verify()` are **async** in this version.

## How to apply

```typescript
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from "otplib";

const totp = new TOTP({
  window: 1,                           // ±30s clock drift
  crypto: new NobleCryptoPlugin(),     // must be instantiated
  base32: new ScureBase32Plugin(),     // option key is "base32" (lowercase)
});

// Sync
const secret = totp.generateSecret(20);

// Async
const token = await totp.generate({ secret });
const result = await totp.verify(token, { secret }); // returns { valid, delta, epoch, timeStep }
const ok = result.valid === true;

// URI for QR code
const uri = totp.toURI({ label: userEmail, issuer: "MyPerfectMeals", secret });
```

Key gotchas:
- `base32` option key is lowercase — not `Base32Plugin` or `encoding`
- Plugins must be `new NobleCryptoPlugin()` and `new ScureBase32Plugin()` (instantiated, not passed as classes)
- `verify()` returns `{ valid: boolean, delta: number, epoch: number, timeStep: number }` — check `result.valid === true`
- `generate()` returns a Promise — must `await` it
