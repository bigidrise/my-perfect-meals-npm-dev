
# 🔒 MACRO CALCULATOR LOCKDOWN

**Last Updated:** January 16, 2025  
**Status:** Production Critical - App Store Submission

## ⚠️ CRITICAL RENDERING RULES

### Cards That MUST ALWAYS Render

The following cards **MUST render on page load** regardless of user input state:

1. **Goal Card** (`#goal-card`) - Always visible
2. **Body Type Card** (`#bodytype-card`) - Always visible  
3. **Details Card** (`#details-card`) - Always visible

### Conditional Rendering Rules

**ONLY these elements** should have conditional rendering:

- **Sync Weight Button** - Only appears after `activity` is selected
- **Results Section** - Only appears after `activity` is selected (shows macro targets)

### Why This Matters

The Details Card contains all the input fields (age, height, weight, activity level). If this card is hidden behind a conditional, users cannot enter their information and the calculator becomes non-functional.

## 🚨 VIOLATION CONSEQUENCES

Any PR that wraps the Goal, Body Type, or Details cards in conditional rendering will:
- Break the calculator workflow
- Fail App Store review (critical functionality broken)
- Require immediate rollback

## ✅ Correct Pattern

```tsx
{/* ⚠️ RENDER GUARD: MUST ALWAYS render */}
<Card id="details-card">
  {/* All input fields */}
  
  {/* ONLY the Sync Weight button is conditional */}
  {activity && (
    <Button id="sync-weight-button">Sync Weight</Button>
  )}
</Card>

{/* Results - CORRECTLY conditional */}
{results && (
  <Card>Macro Targets</Card>
)}
```

## 🔍 Testing Checklist

Before any deployment:
- [ ] Open Macro Calculator
- [ ] Verify Goal card renders immediately
- [ ] Verify Body Type card renders immediately  
- [ ] Verify Details card (with all inputs) renders immediately
- [ ] Verify Sync Weight button only appears after selecting activity
- [ ] Verify Results section only appears after selecting activity
