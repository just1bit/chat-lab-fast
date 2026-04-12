# CS732 Tech Tutorial — Python FastAPI + AI

A hands-on tutorial that teaches **Python / FastAPI** by building a full-stack **AI chatbot** (React frontend + FastAPI backend), with an objective side-by-side comparison to **Node.js / Express** throughout. Local AI model inference via HuggingFace is covered as an advanced chapter to highlight where the Python ecosystem has unique capabilities.

> **Thesis:** FastAPI and Express are two mature backend frameworks with different design philosophies and strengths. This tutorial teaches FastAPI by building, and contextualizes every concept against the Express equivalent so viewers can make informed decisions about which tool fits their project.

---

## Repository Layout

```
cs732-tech-tutorial-just1bit/
├── backend/                  # FastAPI service
│   ├── app/
│   │   ├── main.py           # FastAPI app, CORS, router registration
│   │   ├── config.py         # Pydantic BaseSettings + .env loading
│   │   ├── routers/          # chat / models / conversations endpoints
│   │   ├── services/         # LangChain + HuggingFace orchestration
│   │   ├── schemas/          # Pydantic request/response models
│   │   └── db/               # SQLAlchemy engine & ORM models
│   ├── tests/                # pytest + FastAPI TestClient
│   ├── requirements.txt
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
| Database | PostgreSQL via SQLAlchemy |
| Tests | pytest + FastAPI TestClient |

---

## Getting Started

### Prerequisites

- Python **3.11+**
- Node.js **18+** / npm
- PostgreSQL running locally (or adjust `DATABASE_URL` in `.env`)
- A free OpenRouter API key from <https://openrouter.ai> — the default provider works on the free tier, no paid keys required

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
cp .env.example .env                # then fill in OPENROUTER_API_KEY
uvicorn app.main:app --reload
```

- API:        <http://localhost:8000>
- Swagger UI: <http://localhost:8000/docs>
- ReDoc:      <http://localhost:8000/redoc>
- Health:     <http://localhost:8000/api/health>

Run the tests:

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

Backend settings are loaded from `backend/.env` via Pydantic `BaseSettings`. Copy `.env.example` and adjust:

| Variable | Purpose |
|---|---|
| `ACTIVE_PROVIDER` | Key of the active provider (e.g. `openrouter`, `openai`, `groq`) |
| `ACTIVE_MODEL` | Default model ID for that provider |
| `OPENROUTER_API_KEY` | OpenRouter free-tier key (default path) |
| `OPENAI_API_KEY` / `GROQ_API_KEY` / `TOGETHER_API_KEY` | Optional alternative providers |
| `DATABASE_URL` | SQLAlchemy DSN for PostgreSQL |
| `FRONTEND_ORIGIN` | CORS origin for the Vite dev server |
| `ENABLE_LOCAL_MODELS` | Feature flag for Phase 2 HuggingFace models (default `false`) |

**Never commit `.env`.** API keys are submitted separately on Canvas per the assignment brief.

---

## Roadmap

This project is built in three phases (see the PRD for full detail):

- **Phase 1 — FastAPI fundamentals + external LLM APIs** *(baseline / MVP)*
  Pydantic validation, auto-generated docs, CORS, LangChain `ChatOpenAI` against any OpenAI-compatible endpoint, SSE streaming, PostgreSQL-backed conversation history, and the React chat UI.

- **Phase 2 — Local AI models** *(advanced, optional)*
  HuggingFace Transformers loaded via FastAPI lifespan events, feature-flagged. Demonstrates in-process model inference — the key differentiator vs. Node.js. Total model weights kept under 100 MB for reviewer convenience.

- **Phase 3 — Comparison & polish**
  Side-by-side FastAPI vs. Express code comparisons in the README, test suite (< 10 tests), and setup polish for peer review.

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
