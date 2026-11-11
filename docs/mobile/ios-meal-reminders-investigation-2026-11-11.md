# Native iOS meal reminders — read-only investigation

Date: November 11, 2026. Development source and retained native artifacts only.
No native project changes, Capacitor sync, native build, installation, provider
changes, customer queries, or reminder schedule changes were performed.

## Executive finding

Native delivery is **Capacitor local notifications**, not browser Web Push,
APNs delivery from this server, or a server timer sending directly to the iPhone.
The My Hub layout correction cannot restore missing OS notification requests.

Two concrete compatibility/delivery risks are established in source/history:

1. On July 29 the Hub changed from device-local reminder settings to authenticated
   server-backed slots. The former settings key is not migrated by the current
   active path. A device can therefore have legacy enabled settings without
   corresponding enabled server slots.
2. The retained packaged web bundle in `ios/App/App/public` predates the
   October 22 global restoration layer. Searching its JavaScript found none of
   that layer's distinctive restoration/verification messages. This proves a
   retained-artifact mismatch, **not which binary is installed on the founder's
   phone**.

The exact cause on that phone remains unproven. We did not read its installed
build, permission settings, saved schedules, pending requests or delivery logs.

## Current architecture

- `ProfileSheet` renders `MealReminders`.
- Authenticated GET `/api/user/reminders` reads that user's ordered
  `user_reminder_slots`. PUT fully replaces their schedule, up to six slots.
  Neither endpoint registers an APNs device.
- `mealReminderService` uses the existing native API-routing/fetch setup.
  Strict iOS reads normalize PostgreSQL `HH:MM:00` to `HH:MM` and reject
  unsuccessful/malformed responses rather than silently inventing a schedule.
- `requestNotificationPermission`/`checkNotificationPermission` call
  `@capacitor/local-notifications` permission methods.
- `IOSMealReminderSync` is mounted once inside `AuthProvider`, independent of
  opening Hub. After authentication it binds an owner and restores on initial
  entry, app resume, visibility resume and explicit refresh.
- `iosMealReminderScheduler` serializes account-bound reconciliation. It reads
  saved slots, checks permission for enabled slots, schedules repeating local
  calendar requests at each enabled slot's hour/minute, and verifies them with
  `getPending()`.
- Current IDs are 2000–2005. Managed historical IDs also include 1001–1003.
  The older local-only component used 2001–2003, inside the current managed range.
  New/changed requests are scheduled before obsolete managed requests are
  cancelled. Unrelated IDs are preserved.
- Notification payloads contain the meal label, sound, owner/kind metadata, and
  `/dashboard` tap destination. A local notification listener opens that route.
- Logout/account switching invalidates stale work and cleans managed pending
  requests; it does not delete server settings.
- Once iOS has accepted a local calendar notification, iOS schedules delivery.
  The app does not need a JavaScript background timer or server push to fire it.
  A fresh server read is needed to restore saved settings, not to deliver an
  already pending local request.

### Separate browser pathway

The web UI uses Notification permission, a service-worker Push subscription,
`/api/push/subscribe`, and the server's minute-aligned reminder scheduler.
That server scheduler reads enabled slots plus user timezones and sends through
`PushNotificationService`. A web push subscription is not native registration.
Web connection diagnostics cannot establish native delivery.

## Historical comparison

Before the July 29 replacement, Hub mounted `IOSMealReminders`. That component
loaded `meal_reminder_schedule_v2` from localStorage and scheduled three local
notifications. It did not use the current server slots as schedule authority.

The July replacement introduced the shared server-backed component and a native
mirror invoked after settings saves. Its original mirror cancelled pending
notifications before replacing them and swallowed scheduling errors. It did
not provide the current global login/resume restoration and OS verification.

The October restoration layer addressed those latter lifecycle problems in
source. The old local settings component remains unmounted. The active path
still does not migrate its localStorage record into server settings.

**Conditional migration failure:** if old device-local settings are enabled but
the server has no enabled slots, current restoration's desired set is empty.
The old pending IDs are managed IDs and may be cancelled. This is a demonstrated
source path, not proof that the founder's device has those exact conditions.
Do not silently enable defaults or overwrite saved schedules to compensate.

History establishes changes, not a verified previously working installed build.
No historical physical-device notification recording was supplied.

## Native bridge and configuration

- Capacitor 7 with `@capacitor/local-notifications` 7.0.0 is declared.
- The iOS Podfile and lockfile include `CapacitorLocalNotifications`.
- The retained native config lists `LocalNotificationsPlugin`.
- The plugin's Swift implementation uses `UNUserNotificationCenter`, calendar
  triggers and `getPendingNotificationRequests`.
- Its pending-request serialization preserves `cap_extra` and `cap_schedule`,
  matching the current JavaScript verifier's expected owner and schedule fields.
- AppDelegate uses the normal Capacitor forwarding hooks; no custom competing
  notification delegate was found there.
- Configured sound is `default`; Android-only icon settings do not configure
  iPhone permission or grant delivery.

These are source/configuration checks, not an Xcode compilation or proof that
the currently installed application contains those plugins.

## Is a new Xcode/iOS build required?

Both root and retained native config use bundled assets (`webDir: client/dist`)
without a remote initial `server.url`. No live-update mechanism was identified
in this reminder path.

Therefore **a web Production update alone does not deliver changed reminder
JavaScript into an existing bundled iOS installation**. If the installed app
lacks the current restoration code, it needs an explicitly authorized rebuilt,
synced and distributed iOS app. The source does not currently establish a need
for new Swift code or a new provider.

If the installed app already has current code and the issue is denied
permission, Focus, missing enabled settings or no pending requests, a new native
build may not be necessary. Establish that evidence first.

## Smallest safe next correction

1. Identify the installed app build and its reminder code/configuration.
2. Read permission, saved-slot and pending-request state without changing it.
3. If the restoration layer is missing, package the already existing verified
   layer rather than rewriting scheduling or switching providers.
4. If legacy-only enabled settings explain the mismatch, design a
   consent-preserving, account-bound migration separately. Never silently
   replace existing server settings or cancel the only working schedule first.
5. If requests are present and correct, investigate OS presentation/permission
   before changing application code.

No correction to native functionality is included in this change set.

## Physical iPhone verification protocol

### Read-only evidence first

- Record app version/build, iOS version, device timezone, and whether this is the
  native app or an installed web app.
- Check iOS Settings → Notifications → My Perfect Meals: Allow Notifications,
  Lock Screen/Notification Center/Banners and Sounds as appropriate.
- Check Focus/Do Not Disturb, notification summary/delayed delivery and silent
  mode/volume. Permission being granted does not prove visible/audible delivery.
- Through an authorized Xcode/Safari debugging session, read plugin
  availability, `checkPermissions()` and `getPending()`; compare counts, IDs,
  hour/minute, repeat flag and owner to the saved enabled slots.
- Inspect the old local settings key only with owner approval and without
  exporting account data. Do not infer account ownership from the key alone.
- Do not press **Check iPhone Reminders** during a strictly read-only check:
  despite its name, that button invokes reconciliation and can schedule/cancel
  native requests.

### Delivery test — requires separate approval to change a test schedule

- Use an approved test account/device and record the existing settings first.
- With permission, schedule one test reminder a few minutes ahead.
- Confirm the corresponding repeating calendar request is actually pending.
- Background and lock the phone; observe delivery at the scheduled local time.
- Tap the notification and confirm the Dashboard route.
- Separately verify foreground presentation, relaunch/resume restoration,
  offline delivery of an already pending request, and account-switch cleanup.
- Restore the original test settings only with the same authorization.
- If delivery fails, retain the build, permission, pending-request and OS-log
  evidence; do not repeatedly rebuild or reinstall as a diagnostic substitute.

## Verification performed

Existing fully mocked iOS service, scheduler, global-sync and permission-panel
regressions passed in the focused suite. They exercise JavaScript contracts and
failure handling without calling a real native plugin or changing schedules.
Plugin Swift payload shape and bridge registration were inspected directly.
**No physical iPhone notification delivery or installed-binary verification was
performed. Native reminders are not declared restored.**
