# Android APK

The web app (Vite + React + shadcn/ui) is packaged into a native Android APK
with [Ionic Capacitor](https://capacitorjs.com/). Capacitor wraps the built
`frontend/dist` SPA in a native WebView shell.

```
┌─────────────────────────────────────────┐
│              shadcn/ui                   │  UI components & styling
├─────────────────────────────────────────┤
│            Vite + React                  │  App logic & bundler  → frontend/dist
├─────────────────────────────────────────┤
│          Ionic Capacitor                 │  Native bridge / wrapper
├─────────────────────────────────────────┤
│          Android (WebView + APK)         │  System WebView & APK
└─────────────────────────────────────────┘
```

The native `frontend/android/` project is **not** committed — it's scaffolded on
demand from `capacitor.config.ts` (locally or in CI) via `npx cap add android`.

## ⚠️ Backend URL (read this first)

The APK bundles the **frontend only**. By default the app calls the backend at a
relative path (same-origin), which works when FastAPI serves the SPA but **not**
inside the APK, where there is no co-located backend.

To make the APK functional, deploy the FastAPI backend somewhere reachable and
build with `VITE_API_BASE` pointing at it:

- **Locally:** `VITE_API_BASE=https://your-backend npm run build`
- **In CI:** set a repository variable `VITE_API_BASE`
  (Settings → Secrets and variables → Actions → Variables).

If `VITE_API_BASE` is unset the APK still builds and installs, but login and all
API calls will fail.

## Build the APK locally

Requires the [Android SDK](https://developer.android.com/studio) + JDK 17.

```bash
cd frontend
npm install
npm run build            # build the SPA (set VITE_API_BASE for a real backend)
npx cap add android      # scaffold the native project (first time only)
npx cap sync android     # copy the web build into the native project
cd android
./gradlew assembleDebug  # gradlew.bat on Windows
```

The APK lands at:

```
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

Convenience scripts (in `frontend/package.json`): `npm run cap:sync` (build +
sync), `npm run cap:open` (open in Android Studio).

## CI build & GitHub Release

The workflow [`.github/workflows/android-apk.yml`](.github/workflows/android-apk.yml)
builds the APK on GitHub-hosted runners:

- **Push a version tag** (`v*`, e.g. `v1.0.0`) → builds the APK and **publishes a
  GitHub Release** with the APK attached (under the repo's *Releases* section).
- **Run workflow** (manual `workflow_dispatch`) → builds the APK and uploads it
  as a downloadable **run artifact** (no Release).

Cut a release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The resulting release asset is `chess-analysis-debug.apk`.

## Signing

The CI build produces a **debug-signed** APK — installable directly (you may need
to allow "install from unknown sources"). For a Play-Store-grade **release**
build you'd add a keystore (as encrypted GitHub secrets), switch the Gradle task
to `assembleRelease`, and sign the output. That's intentionally left out here to
avoid managing signing keys.
