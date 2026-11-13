# Flames Coaching

A coaching workspace added beside the existing Flames workout tracker, with an explicit sample mode and a Firebase backend foundation.

## Open locally

Node.js 22 or newer is sufficient to build and run sample mode. No package installation is needed for the sample app.

```sh
node scripts/build.mjs
node scripts/serve.mjs
```

Open http://127.0.0.1:4173/coaching.html. The original tracker remains at `/index.html`.

For a device-only preview without starting a server, generate `Flames-Coaching-Preview.html` with `node scripts/standalone.mjs` and open it in a normal browser. This self-contained sample uses IndexedDB; browsers that restrict storage for local files require the local-server option instead. Firebase mode requires the hosted/local-server app, not the standalone sample.

The top-right workspace selector switches between sample coach and athlete accounts. Sample people and history are fictional. Changes persist in IndexedDB in this browser only. A sample invitation is explicitly a preview and cannot connect real accounts.

Try: create a program → publish → assign to Alex Morgan → switch to Athlete → start workout → log sets → finish → switch to Coach → see history and updated progress. Messages and check-ins work across these sample views. Refresh to verify device persistence.

## Implemented

- Coach/athlete workspaces; dual capabilities in Firebase mode.
- Server-controlled coach activation, live relationship checks and consent.
- Secure invitations: 256-bit server tokens, hash-only storage, verified recipient email, seven-day expiry, one primary coach, revocation, transaction-safe acceptance.
- Program drafts, optimistic revisions, immutable published versions, athlete-specific schedule snapshots.
- Workout sessions, pinned prescriptions, checked sets, completed immutable history and transactional daily totals.
- Account-scoped durable outbox; idempotency receipts committed with mutations; conflict detection; sync retry and JSON backup export.
- Relationship chat, food/macronutrient entry, submitted check-ins and coach feedback.
- Deny-by-default Firestore/Storage rules, callable App Check enforcement, input bounds and per-user request limiting.
- Offline application-shell service worker. No private API responses are placed in the service-worker cache.

## Connect a real Firebase project

The current GitHub source contains no Firebase project configuration, so `config.js` intentionally starts with `firebase: null`. Do not treat sample data as cloud-synchronized data.

The owner subsequently supplied `flamescoaching-21cdf`. Its public Firebase Hosting initialization configuration is saved in `config.firebase.js`, and `.firebaserc` defines an explicit `production` alias without a default deploy target. To build for that project, set `FLAMES_DATA_MODE=firebase` and `FLAMES_APPCHECK_SITE_KEY` before running the build. The build requires the App Check key and never silently falls back to sample mode. Sign in using `scripts/firebase-signin.ps1` on Windows if no Firebase CLI account is authorized. Review existing production security rules and data before deploying replacement rules.

All six rules-emulator tests and all five callable integration scenarios now pass locally. Run `pnpm test:rules` and `pnpm test:integration` with Java 21 available to repeat them. `pnpm install --frozen-lockfile` installs both root and Functions dependencies using the checked-in workspace and lockfile.

1. Select the intended Firebase staging project. Register a web app, enable Google Authentication and Firestore. Choose a Firestore location near users before creating the database.
2. Copy public web configuration from Firebase console into `config.js`, using `config.example.js` as the shape. These are web identifiers, not administrator credentials. Never put service-account keys in client files.
3. Add localhost and the intended deployed domains to Authentication authorized domains. Register those domains with App Check using reCAPTCHA Enterprise; set `appCheckSiteKey`.
4. Install dependencies using an available Node package manager:

```sh
npm install
npm --prefix functions install
```

5. Authenticate the Firebase CLI as an authorized administrator. Run security tests before deploying:

```sh
npm run test
npm run test:rules
firebase deploy --project YOUR_STAGING_PROJECT --only functions:coaching,firestore:rules,firestore:indexes,storage
```

6. Sign in to the app to create the private user profile. Grant initial coach access with Application Default Credentials for the intended project:

```sh
node functions/grant-coach.mjs YOUR_STAGING_PROJECT COACH_USER_UID
```

7. Rebuild the frontend. Vercel uses the included build command and `dist` output directory. Open `/coaching.html`. Firebase backend deployment is a separate step from Vercel frontend deployment.

The callable function is deployed in `us-central1`; change the server options and client `region` together if a different region is appropriate. Firestore/Functions billing and App Check must be set up in the chosen project.

For local Firebase testing, set `emulators: true` only on localhost and use a demo project. Start `firebase emulators:start --project demo-flames-coaching`. Coach onboarding is permitted without admin claims only inside the Functions emulator. Java and installed Firebase tooling are required for Firestore Emulator tests.

## Data contract

`users/{uid}` private profiles; `coachAccounts/{uid}` trusted coach capability; `relationships/{rid}` consent and membership; `athleteCoaching/{uid}` primary-coach lock; `invitations/{sha256Token}` server-only invitations; `programs/{pid}` mutable builder and published pointer; `programs/{pid}/versions/{vid}` immutable definitions; `athletes/{uid}/scheduledWorkouts/{id}` assigned snapshots; `athletes/{uid}/sessions/{sid}` accepted workout records; `athletes/{uid}/dailyStats/{date}` transactional totals; `athletes/{uid}/nutritionDays/{date}` private food entries; `relationships/{rid}/messages/{mid}` chat; `relationships/{rid}/checkIns/{cid}` submissions and feedback.

All mutations use `coaching({action, requestId, data})`. An immutable receipt at `users/{uid}/operations/{requestId}` records payload hash and result. Duplicate identical operations return the original result; reuse with different content is rejected. Do not expire these receipts before the supported offline retry horizon, or old message retries could cease to be idempotent. Invitation results deliberately never persist the bearer token. A lost invitation response requires creating a fresh invitation.

Session updates send `expectedRevision` and a complete bounded session projection. Processing accepts one revision at a time. The device writes projection and queued operation atomically, and removes an operation only after acknowledgement. On a revision conflict the outbox stops and preserves the device copy; automatic overwrites are prohibited. The Settings backup exports it. Two-device conflict-resolution UI and per-session independent queue lanes remain future work.

Ending a relationship revokes future coach reads but preserves the athlete’s own sessions and allows delayed personal uploads. A client cannot recall previously downloaded data. Sign-out requires an empty outbox and clears the local account cache. Browser-local data is not encrypted by an application key; device/browser security remains relevant.

## Scope and next phases

This is a working foundation, not all eight production releases. Still required before a production launch:

- Run emulator/integration tests with actual installed SDKs and staging accounts; verify callable transactions and authorization end to end.
- Complete invitation email delivery, resend management, consent editing, and coach account administration. Verified invitation identity preview is implemented.
- Add recurring assignment schedules, future-only reassignment previews, calendar UI and exercise substitutions.
- Add two-device conflict resolution, completed-session correction/rebuild, explicit abandon-session workflow and account recovery.
- Add paginated history. Current live collection listeners are bounded to 200 records; analytics describe loaded records, not an unbounded all-time total.
- Add FCM delivery, message read states, attachment validation/scanning, and pagination. Storage is intentionally denied until that pipeline exists.
- Add versioned nutrition targets, coach-readable scoped nutrition summaries, versioned check-in templates, recurring reminders, and photo privacy controls.
- Add account export/delete on the backend, retention policies and periodic cleanup of expired rate-limit records (`expiresAt` supports a configured Firestore TTL policy).
- Add monitoring, alert thresholds, managed secrets, abuse controls and a production rules deployment review.

No legacy browser history is imported into cloud sharing automatically. Introduce an explicit athlete-reviewed import if that is needed.

## Verification

`node --test tests/domain.test.mjs` tests verified invitation recipients, expiry/revocation, retries, self-coaching rejection, unsafe IDs, dates, data validation, stable IDs, revision conflicts, immutable history and checked-set volume. `tests/rules.emulator.mjs` exercises cross-user denial, coach revocation, private data, direct-write denial and query constraints against the actual Firestore rules.

Firebase references: https://firebase.google.com/docs/web/setup · https://firebase.google.com/docs/app-check/cloud-functions · https://firebase.google.com/docs/firestore/security/rules-query · https://firebase.google.com/docs/firestore/manage-data/enable-offline
