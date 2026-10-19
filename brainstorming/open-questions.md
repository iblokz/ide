# Open questions

Unresolved choices from the 2026-07-29 exploration. Check off or move into topic docs when decided.

**Settled approach:** see [philosophy-pluggable](philosophy-pluggable.md) — pluggable adapters; fit environment & purpose; Termux/Ollama/hosts as **peers**, not embeds. Questions below are about *order and depth* of adapters, not whether to absorb those tools.

## Product priority

- [ ] What ships first: **assistant**, **terminal panel**, or **SFTP remote FS**?
- [ ] Is Android a first-class target for remote workflows, or Electron-only until the Cap SSH plugin exists?
- [ ] Start-screen IA: how many “Open …” entry points before it feels crowded?

## Assistant

- [ ] Default model recommendation to document (by RAM tiers)?
- [ ] Stream-only chat first, or also “apply patch / replace selection” in v1?
- [ ] Any AGPL concern with specific client SDKs we might pull in?

## Terminal / companions (under philosophy)

- [ ] Which terminal **bridges** first: local PTY (Electron), SSH profiles, and/or WebSocket-to-`ttyd`?
- [ ] On Android, companion depth: detect + “Open Termux” only, or also SSH-to-Termux and/or `RUN_COMMAND`?
- [ ] How do we surface “adapter missing” UX without nagging (one-time hint vs settings)?
- [ ] Bottom panel vs side panel vs toggle with existing console pane?

## Remote FS

- [ ] Rename / API: keep `getFs()` + `resetFs(backend)` or explicit `project.fs` on state?
- [ ] Path model: remote absolute paths vs `sftp://host/path` ids in recent projects?
- [ ] Read-only SFTP mode for demos / untrusted hosts?

## Build hygiene (unblocks size discussions)

- [ ] Strip `.map` and prune stale Parcel hashes from Cap `webDir` on Android release builds?
- [ ] Document expected clean APK size after that?

## iodé / BraX3

- [ ] Do we document a recommended “Termux + iBlokz + LAN Ollama” setup for contributors?
- [ ] SAF / external folder picker on Android ever, or remote FS instead?

---

**Back:** [Home](Home.md)
