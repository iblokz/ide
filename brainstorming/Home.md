# iBlokz IDE — Brainstorming

Living notes for development paths under exploration. Not a roadmap commitment — capture options, constraints, and open questions before implementation.

## Quick links

| Page | Description |
|------|-------------|
| [Philosophy: pluggable, fits the environment](philosophy-pluggable.md) | Approach: adapt to host & purpose; companions as peers, not embeds |
| [Android / BraX3 / iodéOS](android-brax3-iode.md) | What the Capacitor shell actually does; phone as thin client |
| [Offline-first assistant](assistant-offline-first.md) | Local LLMs (Ollama), OpenAI-compatible client, cloud as secondary |
| [Terminal panel & Termux](terminal-panel-and-termux.md) | xterm.js panel, SSH to LAN/hosts, Termux as companion (not embedded) |
| [Remote FS (SSH/SFTP)](remote-fs-sftp.md) | SFTP workspace backend beside `electron` / `capacitor` / `web` |
| [Open questions](open-questions.md) | Unresolved decisions |

## Session notes

- **2026-07-29** — Explored assistant/LLM offline paths, Android+iodé/BraX3 constraints, Termux integration myths vs realities, xterm.js size/APK impact, SSH terminal + SFTP project FS as a unified remote story.
- **2026-07-29** — Captured integration philosophy: pluggable adapters, fit environment & purpose; Termux/Ollama/remote hosts as peers.

## How to use

- Add pages as new `.md` files; link them from here.
- Prefer short topic docs over one mega-file.
- Move settled decisions into `docs/` or issues when implementing; leave brainstorming as the exploration trail.

## Related code today

- FS backends: `src/app/services/fs/` (`electron`, `capacitor`, `web`, `memory`)
- Android: Capacitor 6, Documents/`iblokz-ide` workspace
- Electron: full local FS via preload bridge
