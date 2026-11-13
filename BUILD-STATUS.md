# Build status

Implemented against Hunter-Commander/Flamescoaching at a6be044f1d397cf9d2d941a252d456e5147bef46, retrieved through the connected GitHub integration. That source is a single local-storage workout tracker and differs from the onboarding seen at flamescoaching.vercel.app. The repository-to-live-deployment relationship has not been verified because Vercel team authorization is unavailable.

Verified locally (updated after browser and emulator testing):

- 17 domain/sample tests passed.
- Node syntax checks passed for all 19 source modules and the standalone preview bundle.
- Static output build passed; existing tracker is retained with a coaching link.
- Six Firestore Rules emulator tests passed.
- Five full callable API scenarios passed with Auth, Functions and Firestore emulators: invitations/concurrent acceptance, immutable assignment, revision/idempotent completion/totals, chat/nutrition/check-ins, and relationship revocation with delayed uploads.
- Browser sample workflows passed: program publication and assignment, athlete session start, checked-set persistence after reload, completion/history, messaging, meal logging, submitted check-in and coach feedback. Browser review uncovered a named-form-field collision; form routing now uses the form ID attribute explicitly.

Not verified:

- Production Firebase integration: project `flamescoaching-21cdf` and its public web configuration are known, but Firebase administrator sign-in and the App Check site key are pending.
- Existing production rules/deployment compatibility: audit the existing rules and data before applying replacements.
- Vercel production deployment: team connection authorization is required.
- Responsive device-size and real offline cold-start/multi-device QA remain pending.

The app intentionally defaults to clearly marked sample mode. `config.firebase.js` contains the supplied project's public configuration. Set `FLAMES_DATA_MODE=firebase` and `FLAMES_APPCHECK_SITE_KEY` for a Firebase frontend build. A Firebase build refuses to complete without App Check configuration. Staging/production integration, existing rules audit and backend deployment remain required before real athlete use. The original Vercel production deployment has not been changed.
