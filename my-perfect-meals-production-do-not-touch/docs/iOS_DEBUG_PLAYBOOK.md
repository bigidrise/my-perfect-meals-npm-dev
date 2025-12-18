# iOS Debug Playbook

## Overview
This document captures critical debugging knowledge for the My Perfect Meals iOS app built with Capacitor. These solutions were discovered through extensive debugging sessions and should save hours of troubleshooting.

---

## Quick Reference Commands

### Full Rebuild (Nuclear Option)
When in doubt, run this on your Mac:
```bash
cd ~/Projects/my-perfect-meals-clean-ai && rm -rf ios/App/App/public && npm run build && npx cap copy ios
```
Then in Xcode: **Shift+Cmd+K** (Clean) → **Cmd+R** (Run)

### Sync vs Copy
- `npx cap copy ios` - Copies web assets only (faster, use after web changes)
- `npx cap sync ios` - Copies assets AND updates native plugins (use after adding Capacitor plugins)

---

## Critical Fixes

### 1. Safari Web Inspector Shows Empty/Won't Connect

**Symptom:** Safari → Develop → Simulator dropdown is empty, even though app is running.

**Cause:** iOS 16.4+ requires explicit permission for WKWebView debugging.

**Fix:** Add to `ios/App/App/Info.plist`:
```xml
<key>WKWebViewInspectable</key>
<true/>
```

Or run:
```bash
/usr/libexec/PlistBuddy -c "Add :WKWebViewInspectable bool true" ~/Projects/my-perfect-meals-clean-ai/ios/App/App/Info.plist
```

Then: Clean build folder → Run → Restart Safari → Check Develop menu.

---

### 2. Black Screen After App Launch

**Symptom:** App icon works, splash screen shows, then permanent black screen.

**Common Causes:**

#### A. Stale iOS Bundle
The `ios/App/App/public/` folder contains old web assets.

**Fix:**
```bash
rm -rf ios/App/App/public && npm run build && npx cap copy ios
```

#### B. Replit Dev Banner in index.html
Old builds may contain a Replit development script that crashes WKWebView.

**Fix:** Ensure `client/index.html` is clean HTML5 with NO Replit scripts:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <!-- ... meta tags ... -->
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

#### C. Console Silencing Hiding Errors
Production builds may silence console output, hiding errors.

**Fix:** In `client/src/main.tsx`, comment out console silencing:
```typescript
// if (import.meta.env.PROD) {
//   const noop = () => {};
//   console.log = noop;
//   console.info = noop;
//   console.debug = noop;
// }
```

---

### 3. File Sync Issues Between Replit and Mac

**Symptom:** Changes made in Replit don't appear in iOS app.

**Cause:** Git push blocked or Mac repo diverged from Replit.

**Manual File Update Method:**
When git is blocked, use terminal to update files on Mac:
```bash
cat > ~/Projects/my-perfect-meals-clean-ai/client/index.html << 'EOF'
[paste file contents here]
EOF
```

**Verify File Updated:**
```bash
head -5 ~/Projects/my-perfect-meals-clean-ai/client/index.html
```

---

### 4. Capacitor Native Detection Crashes

**Symptom:** App crashes immediately on iOS but works in browser.

**Cause:** Unsafe Capacitor detection code.

**Fix:** Use safe detection in `client/src/lib/resolveApiBase.ts`:
```typescript
function isCapacitorNative(): boolean {
  try {
    const Capacitor = (window as any).Capacitor;
    return Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}
```

---

## Debugging Workflow

### Step 1: Verify HTML Loads
Add temporary alert to `client/index.html`:
```html
<body>
  <script>alert('HTML LOADED');</script>
  <div id="root"></div>
  ...
</body>
```

- **Alert appears:** HTML and basic JS work, problem is in React/Vite bundle
- **No alert:** WKWebView isn't loading content (check Info.plist, bundle path)

### Step 2: Verify JavaScript Executes
Add alerts to `client/src/main.tsx`:
```typescript
alert('main.tsx executing');

import('./app-entry').then(() => {
  alert('app-entry loaded successfully');
}).catch((err) => {
  alert('app-entry FAILED: ' + err.message);
});
```

### Step 3: Check Safari Web Inspector
1. Run app in Simulator
2. Open Safari → Develop → Simulator → My Perfect Meals
3. Check Console tab for errors
4. Check Network tab for failed requests (404s, CORS errors)

### Step 4: Check Xcode Console
For native iOS crashes that happen before web content loads:
1. Run app in Xcode
2. View → Debug Area → Activate Console
3. Look for WKWebView errors or crash logs

---

## iOS Bundle Structure

```
ios/App/App/
├── Assets.xcassets/          # App icons, splash images
│   ├── AppIcon.appiconset/   # App icon (1024x1024 required)
│   └── Splash.imageset/      # Launch screen images
├── Base.lproj/
│   └── LaunchScreen.storyboard  # Splash screen layout
├── Info.plist                # iOS app configuration
├── public/                   # Web assets (copied from client/dist)
│   ├── index.html
│   └── assets/
│       └── app-entry-*.js
└── capacitor.config.json     # Capacitor config (generated)
```

---

## App Store Submission Pipeline

1. **Build Web Assets (Replit)**
   ```bash
   npm run build
   ```

2. **Copy to iOS (Mac)**
   ```bash
   npx cap copy ios
   ```

3. **Archive in Xcode**
   - Product → Archive
   - Creates .ipa file

4. **Upload to App Store Connect**
   - Use Xcode's Organizer or Transporter app
   - Upload to TestFlight for beta testing
   - Submit for App Review

**Important:** Apple only sees the final Archive. The Replit codebase is never sent directly to Apple.

---

## Environment Checklist

### Mac Requirements
- [ ] Xcode 15+ installed
- [ ] CocoaPods installed (`sudo gem install cocoapods`)
- [ ] Node.js 18+
- [ ] Apple Developer Account ($99/year)

### Project Requirements
- [ ] Bundle ID: `com.myperfectmeals.app`
- [ ] WKWebViewInspectable in Info.plist
- [ ] Clean index.html (no Replit banner)
- [ ] Console silencing disabled for debugging

### Before Each Build
- [ ] `rm -rf ios/App/App/public` (clear old bundle)
- [ ] `npm run build` (fresh web build)
- [ ] `npx cap copy ios` (copy to iOS)
- [ ] Xcode: Clean Build Folder
- [ ] Xcode: Run

---

## Troubleshooting Quick Reference

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Black screen | Stale bundle | Nuclear rebuild |
| Safari Inspector empty | WKWebViewInspectable missing | Add to Info.plist |
| No console output | Console silencing | Comment out in main.tsx |
| Alert works but app black | JS bundle error | Check Safari Console/Network |
| File changes not appearing | Git sync issue | Manual cat command |
| Capacitor crash | Unsafe detection | Use try/catch wrapper |

---

## Last Updated
**Date:** December 3, 2025  
**Status:** Active debugging reference  
**Key Discovery:** WKWebViewInspectable required for iOS 16.4+ Safari debugging
