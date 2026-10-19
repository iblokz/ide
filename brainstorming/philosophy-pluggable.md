# Philosophy: pluggable, fits the environment

Guiding approach for how iBlokz IDE relates to Termux, Ollama, remote hosts, FS backends, and future tools. Prefer this over one-off “should we embed X?” debates.

## One-liner

**iBlokz is a small IDE shell that adapts to where it runs and what you point it at — it does not try to become the whole environment.**

## Three lenses

### 1. Fit the environment

The same product should feel native to each host, without pretending every host is Electron.

| Environment | What “fitting” means |
|-------------|----------------------|
| **Web** | Browser FS APIs / demo memory; no fake local shell |
| **Electron** | Full local FS, optional local PTY, local Ollama on localhost |
| **Android (iodé / BraX3)** | Scoped Documents by default; compose with Termux, LAN PC, cloud — don’t ship a Linux distro inside the APK |
| **Remote project** | Thin client over SSH/SFTP; compute and files live on the host you chose |

Detect and offer what the environment can do; degrade or hide what it can’t. Never require Termux or Ollama to open a file.

### 2. Fit the purpose

iBlokz stays a **playground / IDE shell**: edit, preview, console, project tree. Adjacent jobs belong to specialists:

| Purpose | Prefer |
|---------|--------|
| Package / compile / full Unix userspace on phone | **Termux** (companion) |
| Local LLM inference | **Ollama** / LM Studio / remote API |
| Heavy build agents | Host machine via SSH, not in-WebView magic |
| Language intelligence | LSP later, as a plugin — not baked into every build |

If a feature needs a whole second product, **integrate** with that product; don’t reimplement it inside Cap sync.

### 3. Pluggable and integrable

Extend by **contracts and adapters**, not by absorbing binaries.

Already true for FS (`electron` | `capacitor` | `web` | `memory` → later `sftp`). Aim for the same pattern elsewhere:

| Surface | Pluggable unit | Examples |
|---------|----------------|----------|
| **Workspace FS** | FS backend | local, Documents, SFTP |
| **Assistant** | OpenAI-compatible client | Ollama, cloud, custom base URL |
| **Terminal** | Byte bridge behind xterm | local PTY, SSH profile, Termux sshd, WebSocket PTY |
| **Companions** | Optional detect + intent / deep link | Termux open / `RUN_COMMAND`, “Install Ollama” docs |

**Integrable** means: clear seams (HTTP, SSH, intents, Cap plugins), documented profiles, no hard dependency on a companion being present. Missing adapter → UI explains the gap and how to connect one.

## Implications for Termux (and friends)

- **Not** “embed Termux in the APK.”
- **Yes** “on iodé, iBlokz can *use* Termux when it’s there” (open, SSH to localhost, optional `RUN_COMMAND`).
- Same stance for Ollama: talk to a URL; don’t vendor the runtime.
- Same stance for a desk PC: SFTP + SSH profiles; the phone stays a client.

Companions are **peers in the environment**, not submodules of the IDE.

## Design tests (use when unsure)

1. **Environment test** — If we remove this host’s special capability, does the core IDE still work?
2. **Purpose test** — Are we editing/previewing, or rebuilding apt/ollama/vscode?
3. **Plugin test** — Can this be a backend/profile/intent with zero impact on builds that don’t need it?
4. **Absent test** — If Termux/Ollama/SSH host isn’t installed, do we fail softly with a path to enable it?

If a proposal fails (2) or (3), push it out to a companion or a remote host.

## What this is not

- Not “everything is a microservice.” Keep the shell small and concrete.
- Not anti-feature: deep integration (shared SSH profiles for terminal + SFTP) is encouraged when it stays behind one contract.
- Not a promise that every adapter ships on day one — philosophy guides **order and boundaries**, not schedule.

## Related exploration

- [Terminal panel & Termux](terminal-panel-and-termux.md) — mechanics under this philosophy
- [Offline-first assistant](assistant-offline-first.md) — Ollama as peer runtime
- [Remote FS (SSH/SFTP)](remote-fs-sftp.md) — project-scoped backends
- [Android / BraX3 / iodéOS](android-brax3-iode.md) — environment constraints

---

**Back:** [Home](Home.md)
