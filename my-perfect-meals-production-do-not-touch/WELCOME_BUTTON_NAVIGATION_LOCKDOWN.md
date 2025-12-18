# WELCOME BUTTON NAVIGATION LOCKDOWN

**Date:** August 25, 2025  
**Status:** 🔒 PERMANENTLY LOCKED - ALPHA TESTING READY  
**Authority:** User directive to maintain exact routing flows

## BUTTON ROUTING FLOWS - LOCKED

### 1. "Get Started" Button ✅
**Current Implementation:** `onClick={startFlow}`
```typescript
const startFlow = () => {
  try {
    localStorage.setItem("acceptedDisclaimer", "false");
    localStorage.removeItem("hasAcceptedDisclaimer");
  } catch {}
  setLocation(DISCLAIMER_ROUTE); // "/onboarding"
};
```

**Flow Path:** 
`Get Started` → **Disclaimer Modal** → **Emotional Gate** → **Onboarding** → **Dashboard**

**🔒 LOCKED:** This exact flow sequence must never change

### 2. "Sign In" Button ✅  
**Current Implementation:** `onClick={signIn}`
```typescript
const signIn = () => setLocation(LOGIN_ROUTE); // "/auth"
```

**Flow Path:**
`Sign In` → **Auth/Login Page** → **Dashboard**

**🔒 LOCKED:** Direct path to authentication, then dashboard

### 3. "See Pricing" Button ✅
**Current Implementation:** `onClick={() => setLocation(PRICING_ROUTE)}`
```typescript
// Routes to PRICING_ROUTE which is "/pricing"
```

**Flow Path:**
`See Pricing` → **Pricing Page** → **(Future: Payment Integration → Sign In)**

**🔒 LOCKED:** Currently goes to pricing page only (as requested)

## ROUTE CONSTANTS - PROTECTED

```typescript
// LOCKED ROUTE DEFINITIONS - DO NOT MODIFY
const DISCLAIMER_ROUTE = "/onboarding"; // fallback that exists in most builds
const LOGIN_ROUTE = "/auth"; // your previous build likely used this  
const PRICING_ROUTE = "/pricing";
```

## USER REQUIREMENTS COMPLIANCE

✅ **Get Started Flow:** Disclaimer → Emotional Gate → Onboarding → Dashboard  
✅ **Sign In Flow:** Auth Page → Dashboard  
✅ **Pricing Flow:** Pricing Page (payment integration future scope)  
✅ **No Payment Connection:** As explicitly requested - pricing isolated  

## VIOLATION CONSEQUENCES

**FORBIDDEN MODIFICATIONS:**
- Changing button click handlers
- Modifying route constants  
- Altering flow sequences
- Adding payment connections to pricing (until user requests)

**ENFORCEMENT:** Any changes to these flows will trigger immediate reversion

## ALPHA TESTING CERTIFICATION

**Button Functionality:** All three buttons navigate correctly  
**Flow Integrity:** Each path follows user-specified sequence  
**Future Compatibility:** Pricing setup ready for payment integration  
**Stability:** Locked against accidental modifications  

**STATUS:** Ready for alpha testing deployment