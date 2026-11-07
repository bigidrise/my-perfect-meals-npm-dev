# 🚀 MY PERFECT MEALS — DEPLOYMENT CHEAT SHEET

## 1. DEVELOPMENT → GITHUB

In the Replit Development Shell:

```bash
git branch --show-current
git status -sb
```

Confirm you're on dev and review the changes.

```bash
git diff --check
git status --short
```

Stage only approved files and commit:

```bash
git add path/to/approved-file
git commit -m "Describe the update"
```

Validate and push:

```bash
npm run validate
git fetch origin
git push origin dev
```

STOP if validation fails, branches diverge, or Git rejects the push.
Never force-push.

## 2. GITHUB → PRODUCTION

On GitHub:

1. Open a pull request from dev into production.
2. Review the changes and confirm tests pass.
3. Merge the approved PR into production.

Important:
Never automatically merge all Development changes.
Release only completed, approved work.

## 3. PRODUCTION WORKSPACE → CUSTOMERS

In the Replit Production Shell:

```bash
git branch --show-current
git status -sb
git fetch origin
git pull --ff-only origin production
```

Only pull if you're on production, the working tree is clean, and there are no unexpected local commits or branch differences.
Otherwise, stop.

Then:

```bash
npm run validate
npm run build
```

If checks pass, Publish in Replit.

Verify:

https://app.myperfectmeals.com/api/release

https://app.myperfectmeals.ai/api/release

Both should report the newly approved build.

## 4. iOS — APPLE

For web-based changes that your installed iOS app loads from Production, publish the website first.
A new Xcode build may not be necessary.

For native iOS changes:

1. Synchronize the approved Production code on your Mac.
2. Build and sync Capacitor using the project's verified commands.
3. Open Xcode.
4. Archive and upload to App Store Connect.
5. Test through TestFlight before releasing.

Do not overwrite uncommitted native work.

## 5. ANDROID — GOOGLE PLAY

For web-based changes, publish Production first.

For native Android changes:

1. Synchronize the approved Production code on your development computer.
2. Build and sync Capacitor using the project's verified commands.
3. Open Android Studio.
4. Generate a signed Android App Bundle (.aab).
5. Upload to Google Play Console.
6. Test before releasing to customers.

Confirm the Android project and signing configuration before starting.

## 6. OBJECT STORAGE

Development and Production have separate storage buckets.

* Development: my-perfect-meals-dev (1)
* Production: my-perfect-meals-new-prod

GitHub transfers code, not customer uploads or generated images.
Never switch Production to the Development bucket.

## ⭐ THE GOLDEN RULE

Development → GitHub dev → Approved PR → GitHub production → Replit Production → Publish → Verify customers

For native changes, add the Apple or Android store release process.

A GitHub push is not a customer deployment.
A GitHub merge is not a customer deployment.
Publishing and verifying the live application completes the job.
