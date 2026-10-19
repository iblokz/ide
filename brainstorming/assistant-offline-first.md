# Offline-first code assistant

Explore integrating an LLM / code assistant with **offline priority**, optional cloud later. Not implemented.

**Approach:** [philosophy-pluggable](philosophy-pluggable.md) — Ollama (or any OpenAI-compatible URL) is a peer runtime; the IDE is a client, not a model host.

## Product shape (keep small)

iBlokz is Snabbdom + contenteditable + preview — not a VS Code fork. First UX should be:

- Chat / explain / rewrite on **selection or current file**
- Insert or replace in editor
- Skip ghost-text autocomplete until the editor is stronger

One abstraction: **`AssistantClient`** (`complete` / `chat` / stream) with pluggable backends.

## Recommended offline path

| Layer | Choice | Why |
|--------|--------|-----|
| Runtime | **Ollama** (or LM Studio / llama.cpp server) | User installs separately; OpenAI-compatible HTTP |
| Client | Thin `fetch` + stream to `/v1/chat/completions` | Same code for cloud later |
| Host | **Electron first** | Spawn/talk to `127.0.0.1:11434`; expose via preload if needed |
| Models | e.g. `qwen2.5-coder:7b` / `14b` (by RAM) | Good enough for explain/edit; don’t ship GGUFs in AppImage |

**Do not** bundle multi‑GB weights in the IDE artifact.

## Cloud as second backend

Same OpenAI-compatible client; swap `baseURL` + API key:

- OpenAI, OpenRouter, Groq, Together, self-hosted vLLM, etc.
- Store secrets in Electron safe storage / OS keychain
- Web/Pages: user-supplied URL/key only (no baked-in secrets)

Settings sketch: `provider: 'ollama' | 'openai' | 'custom'`, model name, base URL, optional key.

## Android / BraX3

| Approach | Verdict |
|----------|---------|
| On-device SLM in APK | Possible later (MLC / llama.cpp plugin); weak for real coding; heavy |
| Termux + llama.cpp | User-optional; fragile as product dependency |
| **LAN → PC Ollama** | Best “offline-ish” phone story |
| Cloud API | Easiest quality on phone |

Phone = thin client. See [android-brax3-iode](android-brax3-iode.md).

## Libs (optional)

- Prefer **direct HTTP** over a full Copilot stack
- Vercel AI SDK possible but more React-oriented
- Continue / Aider: study prompts, don’t embed
- LSP later for non-LLM intelligence offline

## License note

Project is **AGPL-3.0**. Local Ollama as a **user process** keeps the boundary clean; avoid shipping proprietary SDKs lightly.

## Sensible first milestone

1. Settings: base URL (default Ollama), model, optional key  
2. Electron: test connection + chat on file/selection  
3. Docs: install Ollama + pull a coder model  
4. Later: cloud presets; Android uses same client over LAN/cloud  

---

**Back:** [Home](Home.md) · **See also:** [terminal](terminal-panel-and-termux.md) (same “point at a host” idea)
