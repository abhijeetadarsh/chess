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

## ⚠️ Make the app reach your backend (read this first)

The APK bundles the **frontend only**. There are three things to get right or
login (and everything else) will fail:

1. **Deploy the FastAPI backend** somewhere the phone can reach — not
   `localhost` (that's the phone itself) and not just your PC's LAN IP unless the
   phone is on the same network. A small VPS / container with **HTTPS** is ideal.

2. **Point the build at it** with `VITE_API_BASE`:
   - Locally: `VITE_API_BASE=https://your-backend npm run build`
   - In CI: set a repository **variable** `VITE_API_BASE`
     (Settings → Secrets and variables → Actions → Variables).

   If unset, the app calls its own WebView origin (`https://localhost`) — there's
   no server there, so login fails.

3. **CORS + transport.** The app calls the backend cross-origin from
   `https://localhost`. The backend already enables permissive CORS
   (`CORS_ORIGINS`, default `*`). Prefer an **HTTPS** backend — Android blocks
   plain-HTTP ("cleartext") by default in release builds. If you must use HTTP,
   add `server: { cleartext: true }` to `capacitor.config.ts` (a security
   downgrade — avoid for real distribution).

## Build the APK locally

Requires the [Android SDK](https://developer.android.com/studio) + JDK 17.

```bash
cd frontend
npm install
VITE_API_BASE=https://your-backend npm run build   # build the SPA
npx cap add android      # scaffold the native project (first time only)
npx cap sync android     # copy the web build into the native project
cd android
./gradlew assembleDebug  # quick local build → app-debug.apk (gradlew.bat on Windows)
```

`assembleDebug` is debug-signed and installable — fine for local testing. CI
produces the proper **signed release** build (below).

Convenience scripts (`frontend/package.json`): `npm run cap:sync` (build + sync),
`npm run cap:open` (open in Android Studio).

## CI build & GitHub Release

[`.github/workflows/android-apk.yml`](.github/workflows/android-apk.yml) builds a
**signed release** APK (`chess-analysis.apk`) on GitHub-hosted runners:

| Trigger | Result |
| --- | --- |
| Push a tag `v*` (e.g. `v1.0.0`) | Builds the APK and **publishes a GitHub Release** with it attached |
| **Run workflow** (manual) | Builds the APK as a downloadable **run artifact**. Fill in the `release_tag` input to also publish a Release |

Cut a release from your machine:

```bash
git tag v1.0.0
git push origin v1.0.0
```

…or use **Actions → Android APK → Run workflow** and set `release_tag` to
`v1.0.0`. The APK is at run **artifacts** when no tag/`release_tag` is given —
that's why a plain manual run won't show up under *Releases*.

## Signing

The release APK must be signed to install. The workflow signs it for you:

- **With your keystore** (recommended) — set these repository **secrets** and the
  build signs with them, giving a **stable** key so users can update in place:

  ```bash
  # 1. Generate a keystore (keep release.jks safe — losing it blocks updates)
  keytool -genkeypair -v -keystore release.jks -alias chess \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass 'CHOOSE_A_PASSWORD' -keypass 'CHOOSE_A_PASSWORD' \
    -dname "CN=Chess Analysis, O=Chess Analysis, C=US"

  # 2. Add the secrets (or paste them in the GitHub UI)
  gh secret set KEYSTORE_BASE64   --body "$(base64 -w0 release.jks)"
  gh secret set KEYSTORE_PASSWORD --body 'CHOOSE_A_PASSWORD'
  gh secret set KEY_ALIAS         --body 'chess'
  gh secret set KEY_PASSWORD      --body 'CHOOSE_A_PASSWORD'
  ```

- **Without secrets** — the build falls back to an **ephemeral** keystore so the
  APK still installs, but each build gets a *different* signing key, so users
  must **uninstall before updating**. Fine for a quick test, not for ongoing
  distribution.

This produces a normal (non-debuggable) release build. It is **not** a Play
Store upload (that needs an AAB and Play App Signing) — it's a directly
installable APK.
