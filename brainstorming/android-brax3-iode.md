# Android / BraX3 / iodéOS

Context for mobile paths. BraX3 (Dimensity 6300, 8 GB RAM, typically **iodéOS**) is a realistic day-to-day device for the author.

**Approach:** [philosophy-pluggable](philosophy-pluggable.md) — fit this environment (scoped FS, compose with Termux/LAN); don’t turn the APK into the whole Unix/LLM stack.

## What ships today

| Piece | Status |
|--------|--------|
| Shell | Capacitor 6 (`org.iblokz.ide`), WebView UI |
| Dev | `./bin/start.sh --android` — Parcel on LAN + Cap live-reload |
| Build | Debug APK → `artifacts/android/` (`./bin/build.sh --android`) |
| Deploy | `adb` via `./bin/deploy.sh --android` |
| FS | App **Documents/`iblokz-ide`** only — not arbitrary device paths |
| Permissions | Basically `INTERNET` + cleartext for live-reload |

Backend selection: Electron → Capacitor → web → memory (`src/app/services/fs/index.js`).

## BraX3 / iodé fit

- **arm64** debug APK sideloads fine (no Play dependency — good for iodé).
- USB / wireless debugging for Cap live-reload; set `CAP_DEV_HOST` if LAN IP detect fails.
- Official iodé is a **`user`** build → **no `adb root`** (not needed for Cap install).
- Workspace stays app-scoped → privacy-friendly; no SAF “pick any folder” yet.

## What is *not* a good fit on-phone

- Bundling desktop-class local LLMs in the APK.
- Embedding Termux inside the Cap WebView (see [terminal panel & Termux](terminal-panel-and-termux.md)).
- Building the full Cap/Gradle pipeline *on* the phone as the primary workflow.

## On-device “dev environment” (outside this repo)

iodé has no special iBlokz setup. Practical stack:

1. **F-Droid** → **Termux** (not Play Termux)
2. `pkg`: git, node/python, editors, optional JDK
3. Optional GUI: Acode / nvim / **iBlokz APK** for Documents workspace
4. PC remains the build host; phone is run target + light editing

## APK size snapshot (2026-07-29)

- **~35 MB** debug APK (`iblokz-ide-1.6.1-android-debug.apk`)
- Unpacked ~105 MB; **~21 MB compressed** is stale Parcel **`.map`** files + duplicate hashed JS in Cap assets
- Cleaner `dist` sync (no maps / no stale hashes) would matter far more than adding xterm (~+0.1 MB)

## Direction implied by other brainstorms

Treat Android as a **thin client**: local Documents when offline/simple; **LAN/cloud** for assistant, terminal, and real projects via SSH/SFTP. Electron stays the offline-first host for heavy local tooling.

---

**Back:** [Home](Home.md) · **See also:** [assistant](assistant-offline-first.md), [terminal](terminal-panel-and-termux.md), [remote FS](remote-fs-sftp.md)
