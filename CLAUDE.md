# Releasing Solis

Every release must do both of these:
1. Bump `const version` in `update.go`.
2. Add an entry at the TOP of `CHANGELOG` in `web/whatsnew.js` with the same version and 1 to 4 short, plain-English notes. Players see it as the "What's new" card the first time they open the app after updating.

Merging to main publishes the release automatically (`.github/workflows/release.yml`).
