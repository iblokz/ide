# Terminal panel & Termux

Goal: a **VS Code / Cursor–like terminal panel** in iBlokz, especially useful on Android when paired with a real shell or remote host.

**Approach:** [philosophy-pluggable](philosophy-pluggable.md) — Termux is an optional **peer** in the environment; the IDE plugs into it (intent / SSH), it is not shipped inside the APK.

## Termux: what it is

Android app that provides a Linux-style userspace + `pkg` (git, node, clang, …). Install from **F-Droid**, not Play. Fits iodé well. It is **not** a library you link into Capacitor.

## Can we put Termux *inside* the APK / panel?

| Idea | Feasible? |
|------|-----------|
| Ship Termux as a Gradle dependency / embed its Activity in the WebView | **No** — separate app/UID; Android doesn’t embed arbitrary third-party UIs |
| Bundle Termux APK beside ours | Still two apps; we don’t merge them |
| Intent companion (`RUN_COMMAND`, open Termux) | **Yes** — optional external runtime |
| Split-screen beside iBlokz | **Yes** — system UX, not in-panel |

**Recommendation:** Termux = **optional companion**, never part of Cap sync.

## Pathway that *does* give an in-IDE panel: xterm.js

**xterm.js** only renders a terminal. Bytes come from a bridge:

```
[xterm.js panel] ←→ [bridge: PTY | SSH | WebSocket] ←→ [shell / host]
```

### Size (`@xterm/xterm` 6.x)

| Artifact | Approx |
|----------|--------|
| ESM `xterm.mjs` | ~337 KB raw / **~89 KB gzip** |
| CSS | ~7 KB |
| APK impact on current ~35 MB debug build | **~+0.1–0.15 MB** (noise) |

Fit / web-links addons: tiny. WebGL addon: optional, heavier — skip on mobile first.

### Connection targets (same UI, different profiles)

| Target | Transport |
|--------|-----------|
| Specific host / VPS | SSH |
| LAN machine (`192.168.x.x`, `.local`) | SSH or ttyd-style WebSocket |
| Termux on same phone | Termux `sshd` → `127.0.0.1` |
| Local shell (Electron / later Cap) | In-process PTY — **not** Termux pkgs |

Settings: host, port, user, auth — profiles like “home PC”, “Termux”, “VPS”.

### What still needs building

- Capacitor / Electron plugin for SSH (or WASM SSH) **or** WebSocket to a host PTY bridge
- Panel chrome in Snabbdom layout (bottom/side pane)
- Auth / key storage

## Soft first steps

1. “Open in Termux” / install hint on Android  
2. xterm panel + SSH profiles (shared with remote FS later)  
3. Optional `RUN_COMMAND` for one-shot scripts  

## Non-goals

- Reimplementing Termux bootstrap inside `org.iblokz.ide`
- Screen-mirroring Termux into a panel

---

**Back:** [Home](Home.md) · **See also:** [remote FS](remote-fs-sftp.md), [android](android-brax3-iode.md)
