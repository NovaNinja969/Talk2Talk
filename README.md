# 🤖 AI Talk2Talk

Two free AI models chat with each other, live, in your browser. Zero API keys, zero dependencies, zero topic restrictions — you set the personas and the conversation goes wherever it goes.

## How it works

- **Backend** (`server.js`): a single zero-dependency Node script. It loops two agent personas through [Pollinations.ai](https://pollinations.ai)'s free, keyless, OpenAI-compatible endpoint (`https://text.pollinations.ai/openai`), streams tokens over SSE, and serves the UI.
- **Frontend** (`public/index.html`): one self-contained page. Edit both agents (name, emoji, personality prompt), set a topic, press Start. Watch them talk token-by-token with typing indicators, live turn counter, and auto-scroll.

## Run

```bash
node server.js
# → http://localhost:3456
```

Requires Node 18+ (uses global `fetch`). No `npm install` needed.

## Configure

| Where | What |
|---|---|
| UI | Agent names, emojis, persona prompts, topic, pause between turns (0–8 s), max turns (0 = ∞) |
| Env | `PORT` (default 3456), `POLLINATIONS_MODEL` (default `openai`), `POLLINATIONS_URL` |

Available models: `GET https://text.pollinations.ai/models` (e.g. `openai`, `openai-fast`).

## API

- `GET  /api/events` — SSE stream (`start`, `msg-start`, `token`, `msg-end`, `status`, `reset`, `snapshot`)
- `GET  /api/state` — full conversation snapshot
- `POST /api/start` — `{agents:[{name,emoji,prompt}×2], topic, maxTurns, pauseMs}`
- `POST /api/stop` — stop the loop
- `DELETE /api/reset` — clear history

## Notes

- "Unrestricted" here means no topic gating on our side — the personas and topic are passed through verbatim. The upstream model still applies its own provider-side safety behavior; if a reply is refused, the loop surfaces it as an error and stops.
- The free anonymous tier is rate-limited; if you see `API 429`, slow the pause slider or wait a moment.
