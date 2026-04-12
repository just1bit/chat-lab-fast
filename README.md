# CS732 Tech Tutorial — Python FastAPI + AI

A hands-on tutorial that teaches **Python / FastAPI** by building a full-stack **AI chatbot** (React frontend + FastAPI backend), with an objective side-by-side comparison to **Node.js / Express** throughout. Local AI model inference via HuggingFace is covered as an advanced chapter to highlight where the Python ecosystem has unique capabilities.

> **Thesis:** FastAPI and Express are two mature backend frameworks with different design philosophies and strengths. This tutorial teaches FastAPI by building, and contextualizes every concept against the Express equivalent so viewers can make informed decisions about which tool fits their project.

---

## Repository Layout

```
cs732-tech-tutorial-just1bit/
├── backend/                  # FastAPI service
│   ├── app/
│   │   ├── main.py           # FastAPI app, CORS, router registration, logging
│   │   ├── config.py         # Pydantic BaseSettings + .env loading
│   │   ├── providers.py      # Loads provider registry from providers.json
│   │   ├── routers/          # chat / models / conversations endpoints
│   │   ├── services/         # LangChain orchestration
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
| Local AI (advanced) | HuggingFace Transformers, feature-flagged |
| Database | SQLAlchemy + SQLite |
| Tests | pytest + FastAPI TestClient |

---

## Getting Started

### Prerequisites

- Python **3.11+**
- Node.js **18+** / npm
- **No database install required** — the project uses a local SQLite file (`chatbot.db`), created automatically on first run.
- An **OpenRouter API key** (free tier available at <https://openrouter.ai>) — set it in `providers.json`.

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
cp providers.json.example providers.json   # then fill in your API key
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

```bash
cd frontend
npm install
npm run dev
```

Opens at <http://localhost:5173>.

---

## Configuration

### Provider configuration — `backend/providers.json`

All provider definitions, API keys, and the active provider/model are managed in a single file: **`backend/providers.json`**. Copy `providers.json.example` to get started.

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

Non-provider settings are loaded from `.env` via Pydantic `BaseSettings`:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./chatbot.db` | SQLite database file path |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS origin for the Vite dev server |
| `ENABLE_LOCAL_MODELS` | `false` | Feature flag for Phase 2 HuggingFace models |

**Never commit `providers.json` or `.env`.** API keys are submitted separately on Canvas per the assignment brief.

---

## API

All endpoints live under `/api` (see Swagger UI at <http://localhost:8000/docs>):

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness probe |
| `GET` | `/api/models` | List providers + models, reports which have API keys configured |
| `POST` | `/api/chat` | Non-streaming chat; persists the turn and returns the assistant reply |
| `GET` | `/api/chat/stream` | Server-Sent Events stream; emits `meta`, `data`, and `done` frames |
| `GET` | `/api/conversations` | List all saved conversations |
| `GET` | `/api/conversations/{id}` | Conversation detail with full message history |
| `DELETE` | `/api/conversations/{id}` | Delete a conversation and its messages |

---

## Roadmap

This project is built in three phases:

- **Phase 1 — FastAPI fundamentals + external LLM APIs** ✅
  Pydantic validation, auto-generated Swagger/ReDoc, CORS, LangChain `ChatOpenAI` against any OpenAI-compatible endpoint, SSE streaming, SQLite-backed conversation history, and the React chat UI.

- **Phase 2 — Local AI models** *(advanced, optional, feature-flagged)*
  HuggingFace Transformers loaded via FastAPI lifespan events. Demonstrates in-process model inference — the key differentiator vs. Node.js. Opt in by installing `transformers` + `torch` and setting `ENABLE_LOCAL_MODELS=true`.

- **Phase 3 — Comparison & polish** ✅
  Side-by-side FastAPI vs. Express comparison in this README, pytest suite (7 tests), and setup polish for peer review.

---

## FastAPI vs. Express — At a Glance

| Aspect | FastAPI (Python) | Express (Node.js) |
|---|---|---|
| Request validation | Pydantic, built-in, auto 422 errors | Requires Zod / Joi / express-validator |
| API docs | Swagger UI + ReDoc auto-generated at `/docs` | Manual `swagger-jsdoc` + `swagger-ui-express` |
| Async model | `asyncio` + ASGI, thread/process pools for CPU | Single-threaded event loop |
| AI / ML ecosystem | PyTorch, HuggingFace, LangChain, scikit-learn | Limited to HTTP calls to external APIs |
| Local model inference | Load and run in-process | Not practically feasible |
| Full-stack language | Python backend, JS/TS frontend | Same language on both sides |
| Dependency injection | Built-in `Depends()` | Manual or third-party |

More depth, worked code comparisons, and a "when to use which" summary land in the README alongside the Phase 3 polish.

---

## License

Coursework for **CS732 (University of Auckland, S1 2026)**. Not intended for production use.
