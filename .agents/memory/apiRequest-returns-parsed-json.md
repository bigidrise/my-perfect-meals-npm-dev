---
name: apiRequest returns parsed JSON, not Response
description: apiRequest() in client/src/lib/queryClient.ts already calls res.json() internally — callers must NOT call .json() again on the result.
---

## The rule

`apiRequest(url, options)` returns `Promise<ParsedJSON>` — the body is already parsed.

**Correct:**
```js
const data = await apiRequest("/api/some/endpoint");
// data is already the parsed object
```

**Wrong (always throws TypeError):**
```js
const res = await apiRequest("/api/some/endpoint");
const data = await res.json(); // TypeError: res.json is not a function
```

**Wrong in .then chains:**
```js
apiRequest("/api/some/endpoint")
  .then((r) => r.json())  // Wrong — r is already parsed, not a Response
  .then((data) => ...)
```

**Correct .then chain:**
```js
apiRequest("/api/some/endpoint")
  .then((data) => ...)  // data is already parsed
```

**Why:** `apiRequest` in `client/src/lib/queryClient.ts` does `return res.json()` at the end. The async function unwraps the Promise. So the resolved value is the parsed JSON body.

**How to apply:** Every time you write a new `apiRequest()` call, use the result directly. Never chain `.json()`. Never do `await res.json()` on the result.

## Discovery context

The certification dashboard and all cert pages were broken this way — dashboard always showed 0%/empty because the double `.json()` always threw, catch block always ran with empty `moduleProgress`. Looked like a backend/save bug but was entirely a frontend double-parse issue.
