# LipiPulse — Pratilipi Author Studio

Offline-first analytics studio for Pratilipi authors running multiple channels.
Daily snapshot deltas across **7D · 30D · Quarterly · Yearly · All-time**, with a
Gemini Vision screenshot auto-detection pipeline.

- **App:** Next.js (App Router) + TypeScript + Tailwind + Framer Motion + IndexedDB
- **Android:** the web app is wrapped with **Capacitor** and compiled to an APK by **GitHub Actions**

---

## 📱 Get the APK (no PC needed)

The repo ships with a workflow that builds the APK on GitHub's servers.

1. Create a new GitHub repository and push/upload this project to it.
2. Open the repo → **Actions** tab → **Build Android APK**.
   The workflow also runs automatically on the first push to `main`.
3. Wait ~6–10 minutes (Java 21 + Android SDK are provisioned by the runner).
4. Open the finished run → **Artifacts** → download **`lipipulse-apk`**.
5. Unzip it → `app-debug.apk`.
6. Copy the APK to your phone, tap it, allow **Install unknown apps**, then **Install**.

> The debug APK is signed with the debug keystore, so it installs directly. It is meant for
> personal use — for Play Store you would create a release keystore and run `assembleRelease`.

### Gemini key inside the APK

An installed APK has no server, so screenshot scanning calls Google **directly from the device**
using the key saved in **Insights → Gemini vision** (`src/lib/gemini.ts`). Without a key the scan
falls back to an offline demo extraction so the review pipeline stays testable.

Get a free key at [aistudio.google.com](https://aistudio.google.com/).

---

## 🌐 Run the web app

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # hosted build, keeps /api/scan
```

`GEMINI_API_KEY` can be set as a server env var for the hosted build; then a personal key is optional.

---

## 🏗️ How the APK build works

```
npm ci
  → node scripts/prepare-apk.mjs   # removes src/app/api, runs `next build` with STATIC_EXPORT=1 → ./out
  → npx cap add android            # Capacitor 8 Android shell
  → npx cap sync android           # copies ./out into the project
  → ./gradlew assembleDebug        # app-debug.apk
```

`.github/workflows/android-apk.yml` runs all of the above on `ubuntu-latest`.

---

## 🧮 Snapshot delta engine

| Table | Unique key |
|---|---|
| `channels` | `id` |
| `stories` | `id`, FK → channel |
| `episodes` | `id`, FK → story |
| `channel_snapshots` | (`channel_id`, `snapshot_date`) |
| `story_snapshots` | (`story_id`, `snapshot_date`) |
| `episode_snapshots` | (`episode_id`, `snapshot_date`) |

Boundary fallback: for `today - N days` the engine picks the exact date, else the closest snapshot
**before** it, else the earliest snapshot. A single baseline snapshot yields a delta of `0`, so
lifetime views never appear as new growth.

---

## 📲 PWA (no APK at all)

Open the hosted app in Chrome → ⋮ → **Install app**. Same offline database, home-screen icon,
full-screen — see **Insights → Install on phone**.
