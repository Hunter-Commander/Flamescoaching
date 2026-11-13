# Deploy Flames Coaching

Target Firebase project: **flamescoaching-21cdf**. Target Vercel application: **flamescoach**. Production opens the coaching app at `/` and `/coaching`; the preserved standalone tracker is at `/tracker`.

## Current release status

Source, locked dependencies, Firebase emulator tests, browser sample workflows and static packaging have been verified. Production activation is pending:

- The owner must enable the Firebase Blaze plan; billing is currently disabled.
- Deploy the Cloud Function after billing is enabled, then run the final live coach/athlete workflow checks.

The new Vercel frontend is live at https://flamescoach.vercel.app. Its Google sign-in domain is authorized. Production Firestore rules and coaching indexes have been deployed; the existing app’s `/users/{uid}` schema-2 rules remain intact and new profiles use `/coachingUsers/{uid}`. The old Vercel app at flamescoaching.vercel.app is unchanged. Cloud Functions deployment is blocked while Firebase billing is disabled.

Inspection found that the initially supplied key was not owned by this project. A project-owned score-based Enterprise key is now registered with Firebase App Check and restricted to flamescoach.vercel.app and flamescoaching.vercel.app. The correct public key is in `config.firebase.js`.

## 1. Configure the existing project

In Firebase Authentication, enable Google sign-in and authorize `flamescoaching.vercel.app` and any intended custom production hostname. In App Check, register web app `1:31463502541:web:e30c876925b0b5c0b6af84` with a **score-based reCAPTCHA Enterprise web key** for those production domains. Do not add localhost to the production key.

Set these environment variables in Vercel **Production**:

| Variable | Value |
| --- | --- |
| `FLAMES_DATA_MODE` | `firebase` |
| `FLAMES_APPCHECK_SITE_KEY` | The public registered Enterprise site key |

Production builds automatically require Firebase mode when `VERCEL_ENV=production`. They reject sample-mode overrides, missing/placeholder App Check keys, emulator configuration, and a different Firebase project. Key validation checks shape; Firebase Console registration still has to be correct.

Preview builds default to explicitly marked sample mode. Do not point untrusted branch previews at real athlete data.

## 2. Install and verify

Use Node.js **22**, pnpm **11.25.0**, and Java **21** for emulator testing.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm test:rules
pnpm test:integration
```

The Functions directory also contains a standalone npm lockfile so Firebase’s remote build does not depend on local pnpm symlinks.

## 3. Deploy the Firebase backend first

Firebase CLI sign-in is complete. The previously deployed Firestore rules were inspected and backed up before deployment; their legacy `/users/{uid}` access conditions are preserved. Coaching uses `/coachingUsers/{uid}` to avoid clobbering the old schema. The merged rules and indexes are already deployed. Billing must be enabled before second-generation Functions can deploy.

After that compatibility review, deploy only the coaching backend and Firestore configuration:

```sh
pnpm exec firebase deploy --project flamescoaching-21cdf --only functions:coaching,firestore:rules,firestore:indexes
```

Do **not** deploy the bundled deny-all Storage rules over an existing bucket as part of this release. The coaching app has no enabled attachment feature and does not need Storage deployment.

Wait until all Firestore indexes are ready. Configure the first coach using `functions/grant-coach.mjs` with administrator Application Default Credentials for the explicitly selected project. Never put an administrator key in this repository, browser configuration or Vercel frontend variables.

## 4. Build and deploy the frontend

The repository’s `vercel.json` selects Node via `package.json`, installs the lockfile, builds `dist`, enables extensionless HTML routes and prevents stale configuration/service-worker responses.

Local production build (PowerShell):

```powershell
node scripts/build.mjs --production
```

A successful build uses the already configured owner-supplied public key and writes `dist/release.json` with mode, target project and asset SHA-256 hashes. Set `FLAMES_APPCHECK_SITE_KEY` only to override that key. A rejected configuration leaves the previous output untouched. The production packaging GitHub workflow builds a downloadable frontend artifact; a variable in the repository’s `production` environment can override the key. It does not deploy or grant credentials.

Verify the existing Vercel project’s connected repository and production branch before merging PR #1. The repository fetched for this work contains an older tracker than the currently visible onboarding, so this link must be checked. Then deploy the reviewed source through that project’s normal Vercel release flow.

## 5. Verify the deployed system

Use two test accounts before admitting athletes:

1. Sign in as the approved coach; invite the athlete’s exact email.
2. Sign in as the athlete; confirm coach identity and sharing consent; accept once.
3. Publish and assign a program. Verify it appears on the athlete device.
4. Log a set, reload, complete the workout, and verify the coach sees one completion with correct volume.
5. Verify chat and check-in review. Confirm the coach cannot read private food records.
6. End the connection. Confirm coach access and new chat stop, while the athlete retains personal history.
7. Check browser errors, function logs and App Check metrics.

Keep the previous Vercel deployment and the exported Firestore rules for rollback. Restore a previously verified backend/rules version if a backend change is incompatible; a frontend rollback does not automatically roll back Firebase.

Platform references: [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [Vercel environment variables](https://vercel.com/docs/environment-variables/system-environment-variables), [Firebase App Check setup](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).
