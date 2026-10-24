# Cash Diamond store apps (Android + iOS)

Capacitor wraps the same game as the web app. The store build (`build.py --store`) has no service worker,
bundles its fonts, and sells the Full Game through Apple / Google in-app purchase (`src/native.js`,
product id `cashdiamond_full_game`) instead of the Stripe link.

    npm ci
    npm run sync                 # build www/ and copy it into android/ and ios/
    node test-store.mjs          # buy / restore / offline check at phone and open-Fold sizes
    node store-art.mjs           # icon, splash, Play feature graphic -> assets/, store/
    npx capacitor-assets generate --iconBackgroundColor '#1d4fa3' --splashBackgroundColor '#1d4fa3'
    node store-shots.mjs         # store screenshots -> store/screenshots/

Android: `cd android && ./gradlew bundleRelease` makes the Play upload file. Signing needs
`android/keystore.properties` (not in git; the upload key is kept in the project files).
Bump `versionCode` in `android/app/build.gradle` for every upload.

iOS: GitHub Actions > "iOS to TestFlight" builds on a Mac and uploads (needs the App Store Connect API key secrets).

Store text, product setup, and kids/privacy answers: `store/LISTING.md`.
