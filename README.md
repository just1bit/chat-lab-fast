# chat-lab-fast

A self-hosted, multi-provider AI chat platform. Talks to any OpenAI-compatible endpoint — OpenAI, DeepSeek, OpenRouter, … — and can also load HuggingFace models directly into the API server with no external inference service required.

> React + FastAPI + LangChain + SQLAlchemy.

---

## Features

- **Any OpenAI-compatible provider** — OpenAI, DeepSeek, OpenRouter, or any other endpoint. Add more providers by editing one JSON file; no code changes.
- **In-process HuggingFace inference** — model weights load straight into the FastAPI process. No external inference server.
- **Parallel conversations** — multiple threads stream at once, each with its own memory.
- **Persistent history** — every turn is stored in SQLite and restored on reload.
- **Auto-generated API docs** — Swagger UI and ReDoc, out of the box.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + TypeScript + Tailwind CSS |
| Backend | Python 3.11+ + FastAPI + Uvicorn |
| AI orchestration | LangChain (`ChatOpenAI`) |
| Local AI (optional) | HuggingFace Transformers |
| Database | SQLAlchemy + SQLite |
| Tests | pytest + FastAPI TestClient |

---

## Repository Layout

```
chat-lab-fast/
├── backend/                  # FastAPI service
│   ├── app/
│   │   ├── main.py           # App factory, CORS, lifespan, logging
│   │   ├── config.py         # Pydantic settings from .env
│   │   ├── providers.py      # Provider registry loader
│   │   ├── routers/          # chat / models / conversations
│   │   ├── services/         # LLM orchestration + local inference
│   │   ├── schemas/          # Pydantic DTOs
│   │   └── db/               # SQLAlchemy models + session
│   ├── tests/
│   ├── requirements.txt
│   ├── providers.json.example
│   └── .env.example
└── frontend/                 # Vite + React + TypeScript
    ├── src/
    ├── package.json
    └── vite.config.ts
```

---

## Getting Started

### Prerequisites

- Python **3.11+**
- Node.js **20.19+** (required by Vite 8)
- An **OpenRouter API key** (or any other OpenAI-compatible provider) — grab one at <https://openrouter.ai/keys>.

SQLite is used via a local file and needs no separate install.

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
cp providers.json.example providers.json   # paste your key into providers.openrouter.api_key
uvicorn app.main:app --reload
```

Served at <http://localhost:8000>; Swagger UI at `/docs`.

Tests run offline (in-memory SQLite, mocked LLM calls):

```bash
pytest
```

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Opens at <http://localhost:5173>.

---

## Configuration

### `backend/providers.json`

All providers, API keys, and the default model live in one file:

```jsonc
{
  "active_provider": "openrouter",
  "active_model": "openrouter/free",

  "providers": {
    "openrouter": {
      "display_name": "OpenRouter",
      "base_url": "https://openrouter.ai/api/v1",
      "api_key": "<your-key>",
      "models": ["openrouter/free"]
    },
    "my-provider": {
      "display_name": "My Provider",
      "base_url": "https://api.example.com/v1",
      "api_key": "sk-xxx",
      "models": ["model-a", "model-b"]
    }
  }
}
```

Any entry under `providers` shows up in the UI dropdown. `providers.json` is gitignored — don't commit real keys.

### `backend/.env`

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./chatbot.db` | SQLite file path |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS origin |
| `ENABLE_LOCAL_MODELS` | `false` | Enable in-process HuggingFace models |

Defaults work out of the box.

---

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness probe |
| `GET` | `/api/models` | Providers and models, with availability flags |
| `POST` | `/api/chat` | One-shot chat; persists the turn and returns the reply |
| `GET` | `/api/chat/stream` | SSE stream; events: `meta`, `data`, `status`, `done`, `error` |
| `GET` | `/api/conversations` | List saved conversations |
| `GET` | `/api/conversations/{id}` | Conversation detail with message history |
| `DELETE` | `/api/conversations/{id}` | Delete a conversation |

Full spec at <http://localhost:8000/docs> (Swagger) and `/redoc`.

---

## Local Models

HuggingFace models run inside the FastAPI process — no external inference service. The default is [SmolLM2-135M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct) (~270 MB), small enough for a laptop.

Enable:

```bash
pip install transformers torch
# then set ENABLE_LOCAL_MODELS=true in backend/.env
uvicorn app.main:app --reload
```

Weights download to `~/.cache/huggingface/hub/` on first run and cache there after. Every model listed under the `local` provider in `providers.json` is loaded into memory at startup, so switching between them in the UI is instant. Instruction-tuned models (with a chat template) and base dialogue models are both supported.

When disabled, the local provider appears as `Local Model (not loaded)` in the dropdown and is un-selectable.

---

## License

[MIT](./LICENSE)
