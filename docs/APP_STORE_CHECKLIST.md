# App Store Submission Checklist

## Overview
This checklist tracks all requirements for Apple App Store submission. Target launch: January 2025.

---

## Apple Compliance Requirements

### Privacy & Legal (Guideline 5.1.1)
- [x] **Privacy Policy page** - `/privacy` route implemented
- [x] **Terms of Service page** - `/terms` route implemented
- [x] **Delete Account functionality** - Available in Profile settings
- [x] **Medical Disclaimer** - Guideline 5.2.1 (health/fitness apps)

### Payment Compliance (Guideline 3.1.1 & 3.1.2)
- [x] **iOS Payment Block** - External payment links blocked on iOS
- [x] **Restore Purchases button** - Syncs with Stripe
- [x] **Subscription terms disclosure** - Trial, auto-renewal, pricing shown

### User Experience
- [x] **Forgot Password** - Email reset functionality
- [x] **Support Contact** - Available in Profile + About page

---

## App Assets (Mac iOS Project)

### Required Assets
- [x] **App Icon** - 1024x1024 in Assets.xcassets/AppIcon.appiconset
- [x] **Splash Images** - 24 variants in Assets.xcassets/Splash.imageset
- [x] **LaunchScreen.storyboard** - Configured for splash display

### Info.plist Configuration
- [x] **Bundle ID** - `com.myperfectmeals.app`
- [x] **WKWebViewInspectable** - Enabled for debugging
- [ ] **NSCameraUsageDescription** - "Take food photos for AI nutrition analysis"
- [ ] **NSMicrophoneUsageDescription** - "Voice commands for hands-free meal logging"
- [ ] **NSPhotoLibraryUsageDescription** - "Select food photos from your library"

---

## Developer Shortcuts to Remove

**KEEP THESE FOR NOW** - Remove only before final App Store submission:

### Welcome.tsx (lines ~243-293)
- [ ] Tester buttons for quick access
- **Status:** Keep during development/beta testing

### DisclaimerModal.tsx
- [ ] Ctrl+D keyboard bypass
- [ ] X close button (should require acceptance)
- **Status:** Keep during development/beta testing

### EmotionalGate.tsx
- [ ] Bypass text for testing
- **Status:** Keep during development/beta testing

### features/access.ts
- [ ] TESTER_ALPHA always-return logic
- **Status:** Keep during development/beta testing

### Tutorial/Coach Shortcuts
- [ ] Reset shortcuts for testing
- **Status:** Keep during development/beta testing

---

## TestFlight Beta Testing

### Before TestFlight Upload
- [ ] All compliance items checked above
- [ ] Privacy strings in Info.plist
- [ ] No console.log silencing (for crash reports)
- [ ] Fresh build: `npm run build && npx cap copy ios`
- [ ] Clean Xcode build

### Beta Tester Groups
- [ ] Internal testers (development team)
- [ ] External testers (trainers, doctors, clients)
- [ ] TestFlight link generated

---

## Final App Store Submission

### Before Submission
- [ ] Remove ALL developer shortcuts listed above
- [ ] Re-enable console silencing for production
- [ ] Final privacy policy review
- [ ] Final terms of service review
- [ ] App Store screenshots (6.5", 5.5" iPhone sizes minimum)
- [ ] App description and keywords
- [ ] Support URL
- [ ] Marketing URL (optional)

### App Store Connect
- [ ] App created in App Store Connect
- [ ] Bundle ID matches Xcode project
- [ ] App Information filled out
- [ ] Pricing set (Free with In-App Purchases)
- [ ] In-App Purchases configured:
  - [ ] Basic tier ($9.99/month)
  - [ ] Premium tier ($19.99/month)
  - [ ] Ultimate tier ($29.99/month)
- [ ] Age rating completed
- [ ] App Review Information provided

### StoreKit Integration (Required for iOS payments)
- [ ] StoreKit 2 implemented
- [ ] Product IDs match App Store Connect
- [ ] Purchase flow tested
- [ ] Restore purchases working
- [ ] Receipt validation implemented

---

## Submission Timeline

### Phase 1: Development (Current)
- All features locked and stable
- iOS debugging resolved
- Developer shortcuts active for testing

### Phase 2: TestFlight Beta
- Upload to TestFlight
- Beta tester feedback
- Bug fixes as needed

### Phase 3: App Store Submission (January 2025)
- Remove developer shortcuts
- Final review
- Submit for App Review
- Respond to any App Review feedback

---

## Notes

### Subscription Model
- 7-day free trial
- Basic: $9.99/month
- Premium: $19.99/month  
- Ultimate: $29.99/month

### Apple's Cut
- 30% standard commission
- 15% for Small Business Program (if eligible)

### StoreKit vs Stripe
- **iOS App:** Must use StoreKit (Apple's payment system)
- **Web App:** Can use Stripe directly
- **Stripe blocked on iOS** per Guideline 3.1.1

---

## Last Updated
**Date:** December 3, 2025  
**Status:** Pre-TestFlight preparation  
**Next Step:** Resolve iOS black screen issue, then TestFlight upload
