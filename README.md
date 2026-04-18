# CS732 Tech Tutorial — Python FastAPI + AI

A hands-on tutorial on **Python FastAPI** — the Python alternative to Express, and an increasingly popular backend framework in AI projects.

It is demonstrated by building a full-stack **AI chatbot**: React on the frontend, FastAPI + SQLAlchemy + LangChain on the backend.

---

## Architecture

Monorepo full-stack layered architecture: a React SPA talks to a FastAPI backend over REST + SSE. The backend splits `routers` (HTTP endpoints) from `services` (LLM orchestration and local inference); persistence is SQLAlchemy models accessed through a per-request session dependency.

## Repository Layout

```
cs732-tech-tutorial-just1bit/
├── backend/                  # FastAPI service
│   ├── app/
│   │   ├── main.py           # FastAPI app, CORS, router registration, logging
│   │   ├── config.py         # Pydantic BaseSettings + .env loading
│   │   ├── providers.py      # Loads provider registry from providers.json
│   │   ├── routers/          # chat / models / conversations endpoints
│   │   ├── services/         # LangChain orchestration + local model inference
│   │   ├── schemas/          # Pydantic request/response models
│   │   └── db/               # SQLAlchemy engine & ORM models
│   ├── tests/                # pytest + FastAPI TestClient
│   ├── requirements.txt
│   ├── providers.json.example
│   └── .env.example
├── frontend/                 # Vite + React + TypeScript
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + TypeScript + Tailwind CSS |
| Backend | Python 3.11+ + FastAPI + Uvicorn |
| AI orchestration | LangChain (`ChatOpenAI` — any OpenAI-compatible endpoint) |
| Local AI (optional) | HuggingFace Transformers (in-process inference) |
| Database | SQLAlchemy + SQLite |
| Tests | pytest + FastAPI TestClient |

---

## Getting Started

### Prerequisites

- Python **3.11+**
- Node.js **20.19+** / npm (required by Vite 8)
- **No database install required** — the project uses a local SQLite file (`chatbot.db`), created automatically on first run.
- An **OpenRouter API key** — sign up at <https://openrouter.ai>, then create a key at <https://openrouter.ai/keys>. If you are reviewing this assignment, grab the `providers.json` I uploaded to Canvas instead and skip creating your own key.

### 1. Clone

```bash
git clone https://github.com/UOA-CS732-S1-2026/cs732-tech-tutorial-just1bit.git
cd cs732-tech-tutorial-just1bit
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Peer reviewers: drop the providers.json from Canvas into this folder and skip the next line.
cp providers.json.example providers.json   # then paste your OpenRouter key into providers.openrouter.api_key
uvicorn app.main:app --reload
```

- API:        <http://localhost:8000>
- Swagger UI: <http://localhost:8000/docs>
- ReDoc:      <http://localhost:8000/redoc>
- Health:     <http://localhost:8000/api/health>

Run the tests (no API keys or database setup required — tests use an in-memory SQLite DB and mock the LLM calls):

```bash
pytest
```

### 3. Frontend

Open a **second terminal** (keep the backend running in the first):

```bash
cd frontend
npm install
npm run dev
```

Opens at <http://localhost:5173>.

---

## Configuration

### Provider configuration — `backend/providers.json`

All provider definitions, API keys, and the active provider/model are managed in a single file: **`backend/providers.json`**.

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
    }
  }
}
```

**Adding a new provider** — just add an entry under `providers`. Any OpenAI-compatible API works:

```jsonc
{
  "providers": {
    "my-provider": {
      "display_name": "My Provider",
      "base_url": "https://api.example.com/v1",
      "api_key": "sk-xxx",
      "models": ["model-a", "model-b"]
    }
  }
}
```

Then set `"active_provider": "my-provider"` and `"active_model": "model-a"` to use it.

### Environment — `backend/.env`

Non-provider settings are loaded from `.env` via Pydantic `BaseSettings`. Create it by copying the template:

```bash
cp .env.example .env
```

The defaults work out of the box — no edits are required unless you want to turn on local models (see below).

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./chatbot.db` | SQLite database file path |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS origin for the Vite dev server |
| `ENABLE_LOCAL_MODELS` | `false` | Set to `true` to enable local HuggingFace model inference |

`.env` holds no secrets in this project, so it doesn't need to be shared via Canvas — `providers.json` is the only file with real API keys.

---

## API

All endpoints live under `/api` (see Swagger UI at <http://localhost:8000/docs>):

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness probe |
| `GET` | `/api/models` | List providers + models, reports which have API keys configured |
| `POST` | `/api/chat` | Non-streaming chat; persists the turn and returns the assistant reply |
| `GET` | `/api/chat/stream` | Server-Sent Events stream; emits `meta`, `data`, `status`, `done`, and `error` events |
| `GET` | `/api/conversations` | List all saved conversations |
| `GET` | `/api/conversations/{id}` | Conversation detail with full message history |
| `DELETE` | `/api/conversations/{id}` | Delete a conversation and its messages |

---

## Local AI Models (Advanced, Optional)

This is the key differentiator of the tutorial — **Python can load ML model weights directly into the FastAPI process and run inference in-process, something Node.js/Express can't practically do at comparable scale or with comparable tooling.**

The default local model is [SmolLM2-135M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct) (~270 MB download), a lightweight instruction-tuned model that can hold a conversation. Local models appear alongside cloud providers in the same UI dropdown — select one and chat.

### Setup

1. Install the optional dependencies:

   ```bash
   pip install transformers torch
   ```

2. Flip the feature flag in `backend/.env`:

   ```ini
   ENABLE_LOCAL_MODELS=true
   ```

3. Start the backend — models are downloaded and loaded automatically on startup:

   ```bash
   uvicorn app.main:app --reload
   ```

On first startup, the model weights are downloaded from HuggingFace Hub to `~/.cache/huggingface/hub/` and loaded into memory. Subsequent startups load from the local cache.

### Adding / Swapping Models

Local models are configured in `providers.json` alongside cloud providers — just add HuggingFace model IDs to the `models` list:

```jsonc
{
  "local": {
    "display_name": "Local Model",
    "base_url": "",
    "api_key": "",
    "models": ["HuggingFaceTB/SmolLM2-135M-Instruct"],
    "is_local": true
  }
}
```

All listed models are downloaded and loaded into memory at startup, so switching between them in the UI is instant. The system automatically detects whether a model is instruction-tuned (uses `apply_chat_template`) or a base dialogue model, so any compatible HuggingFace model should work.

### Without Local Models

The app works fully without local models — just leave `ENABLE_LOCAL_MODELS=false` (the default). The local provider appears in the dropdown as `Local Model (not loaded)` and is un-selectable. (Cloud providers missing an API key show up as `DisplayName (key missing)` for the same reason.)

---

## FastAPI vs. Express

| Aspect | FastAPI (Python) | Express (Node.js) |
|---|---|---|
| Validation & docs | Pydantic + auto Swagger/ReDoc, built in | Assemble yourself or via external tools |
| Async model | `asyncio` + ASGI, thread/process pools for CPU | Single-threaded event loop |
| AI / ML ecosystem | PyTorch, HuggingFace, LangChain, scikit-learn | Limited to HTTP calls to external APIs |
| Local model inference | Load and run in-process | Not practically feasible |
| Full-stack language | Python backend, JS/TS frontend | Same language on both sides |
| Dependency injection | Built-in `Depends()` | Manual or third-party |

---

## License

Coursework for **CS732 (University of Auckland, S1 2026)**. Not intended for production use.
