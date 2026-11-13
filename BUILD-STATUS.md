# Build status

Implemented against Hunter-Commander/Flamescoaching at a6be044f1d397cf9d2d941a252d456e5147bef46, retrieved through the connected GitHub integration. That source is a single local-storage workout tracker and differs from the onboarding seen at flamescoaching.vercel.app. The repository-to-live-deployment relationship has not been verified because Vercel team authorization is unavailable.

Verified locally (updated after browser and emulator testing):

- 25 build-configuration/domain/sample tests passed.
- Node syntax checks passed for all 21 source modules and the standalone preview bundle.
- Static output build passed; existing tracker is retained with a coaching link.
- Six Firestore Rules emulator tests passed.
- Five full callable API scenarios passed with Auth, Functions and Firestore emulators: invitations/concurrent acceptance, immutable assignment, revision/idempotent completion/totals, chat/nutrition/check-ins, and relationship revocation with delayed uploads.
- Browser sample workflows passed: program publication and assignment, athlete session start, checked-set persistence after reload, completion/history, messaging, meal logging, submitted check-in and coach feedback. Browser review uncovered a named-form-field collision; form routing now uses the form ID attribute explicitly.
- Production build guards reject missing App Check configuration without modifying previous output; Vercel production cannot publish sample mode. DEPLOY.md records the exact release order and the remaining external prerequisites.
- Firebase-enabled production build succeeds with the owner-supplied App Check key. Its release manifest pins `flamescoaching-21cdf`, disables emulators and records asset checksums.
- Backend dependencies are pinned (Firebase Admin 14.5.1, Functions 7.4.0), with a portable npm lockfile; the production dependency audit reports zero vulnerabilities. Emulator tests passed again after this upgrade.

Not verified:

- Production Firebase integration: project `flamescoaching-21cdf`, public web configuration and the owner-supplied App Check site key are configured. Firebase administrator sign-in and actual production integration verification are pending.
- Existing production rules/deployment compatibility: audit the existing rules and data before applying replacements.
- Vercel production deployment: team connection authorization is required.
- Responsive device-size and real offline cold-start/multi-device QA remain pending.

The app intentionally defaults to clearly marked sample mode. `config.firebase.js` contains the supplied project's public configuration. Set `FLAMES_DATA_MODE=firebase` and `FLAMES_APPCHECK_SITE_KEY` for a Firebase frontend build. A Firebase build refuses to complete without App Check configuration. Staging/production integration, existing rules audit and backend deployment remain required before real athlete use. The original Vercel production deployment has not been changed.
