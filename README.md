# OpenForge Edge 🛠️
**Offline-First Multimodal AI Copilot for Hardware Repair & Diagnostics**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Multi--Agent-orange)](https://langchain-ai.github.io/langgraph/)

OpenForge Edge (formerly Forge Assist) is a zero-trust, offline-first multimodal AI copilot designed for hardware repair technicians, micro-soldering specialists, and the Right-to-Repair community.

Built to run entirely on local edge devices, OpenForge Edge removes the reliance on expensive cloud API tokens and ensures absolute customer data privacy at the repair bench. By leveraging multi-agent routing and local RAG, it provides technicians with interactive board diagnostics, real-time multimeter HUDs, and guided training workflows without ever sending proprietary schematics or customer details to the cloud.

---

## 🚀 Key Features

*   **Zero-Trust Edge Inference:** Runs 100% offline using local LLMs (default `qwen2.5:7b` via Ollama, or AMD Lemonade), ensuring customer data privacy and eliminating cloud compute costs.
*   **Streaming Bench Chat:** Large, high-contrast chat built for use mid-repair. Answers stream in as they are generated, with live agent status ("Triaging issue…", "Searching schematics…") and cited manual excerpts.
*   **Multimeter HUD & Diode Testing:** Logged readings flagged in/out of range against expected values for each test point.
*   **Interactive Screw Maps:** Step-by-step teardown tracking to prevent hardware mix-ups during complex repairs.
*   **Local RAG for Repair Manuals:** Semantic search across repair guides, schematics, and datasheets powered by ChromaDB.
*   **Computer Vision Ingestion Pipeline** *(planned)*: OCR pipeline that processes XZZ schematic screenshots into structured JSON for the vector database.

> **Current status:** the schematic RAG agent searches built-in sample excerpts, and the HUD shows sample readings. Manual ingestion into ChromaDB and live meter input are in progress.

---

## 🏗️ Architecture & Tech Stack

OpenForge Edge uses a decoupled, containerized architecture optimized for local execution via WSL2 and Docker. The LLM engine runs on the host so it can use the local GPU/NPU directly.

```
 Browser ──▶ frontend (Next.js :3000)
    │
    └──────▶ backend (FastAPI :8000) ──▶ LangGraph: triage ─▶ schematic_rag ─▶ respond
                 │        │                                         │
                 │        └──▶ chromadb (:8001)                     └──▶ Ollama / Lemonade (host)
                 └──▶ mongodb (:27017)
```

### Frontend (The Bench UI)
*   **Framework:** Next.js 15 & React 19
*   **Styling:** Tailwind CSS 4
*   **State Management:** Zustand (session persisted in the browser)
*   **Icons:** Lucide React

### Backend (Multi-Agent Routing)
*   **API:** FastAPI (running via Uvicorn)
*   **Agent Framework:** LangGraph. A `TriageAgent` identifies the issue and routes to specialist agents (currently `SchematicRAGAgent`), then a responder writes the final answer.
*   **Local AI Engine:** Ollama (`ChatOllama`) or any OpenAI-compatible server such as AMD Lemonade

### Data Layer
*   **Document Store:** MongoDB 8
*   **Vector Database:** ChromaDB

### Project Structure
```
├── app/                    Next.js layout, page, global styles
├── components/             ChatPanel, HudSidebar, SessionHeader
├── lib/copilot.ts          Streaming client for the backend API
├── store/useRepairStore.ts Zustand repair-session store
├── backend/
│   ├── main.py             FastAPI app and endpoints
│   ├── graph.py            LangGraph wiring
│   ├── agents/             triage, schematic_rag, responder + registry
│   ├── llm.py, config.py, state.py
│   └── requirements.txt
├── Dockerfile.frontend
├── Dockerfile.backend
├── docker-compose.yml
└── .env.example
```

---

## 🛠️ Getting Started

### Prerequisites
*   Windows 11 with WSL2 enabled (or a native Linux environment)
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/) with Docker Compose (WSL2 backend on Windows)
*   [Ollama](https://ollama.com/download) installed on the host (or AMD Lemonade, see [Using AMD Lemonade](#using-amd-lemonade))
*   ~8 GB free disk space (model + Docker images); 16 GB RAM recommended for 7B models
*   For local development only: Node.js 20+ and Python 3.11+

### 1. Clone the repository
```bash
git clone https://github.com/JP21-dev/OpenForge-Edge.git
cd OpenForge-Edge
```

### 2. Install the local model
Start Ollama, then pull the default model (~4.7 GB):
```bash
ollama pull qwen2.5:7b
```
Check that Ollama is serving it:
```bash
ollama list
```

> **Windows:** if `ollama` isn't found, use the full path: `%LOCALAPPDATA%\Programs\Ollama\ollama.exe`.
>
> **Lower-spec machines:** `llama3.2:3b` (~2 GB) is faster but less accurate. Pull it and set `LLM_MODEL=llama3.2:3b` in `.env`.

### 3. Configure environment variables
Copy the example file:
```bash
cp .env.example .env
```
(PowerShell: `Copy-Item .env.example .env`)

Then edit `.env`. At minimum, **change `MONGO_ROOT_PASSWORD`** before the first launch. MongoDB only applies these credentials when its data volume is first created.

*(Note: Ensure all proprietary service manuals or specific enterprise network configs are sanitized from your `.env` before running.)*

### 4. Launch the stack
Make sure Docker Desktop is running, then build and start all four services:
```bash
docker compose up -d --build
```
The first build takes several minutes (the backend installs ChromaDB and LangChain).

| Service | URL | Notes |
|---|---|---|
| Bench UI | http://localhost:3000 | Open this in your browser |
| Backend API | http://localhost:8000 | Interactive docs at `/docs` |
| ChromaDB | http://localhost:8001 | Vector store |
| MongoDB | `mongodb://localhost:27017` | Credentials from `.env` |

All ports bind to `127.0.0.1`, so the databases are never exposed to the shop network.

### 5. Verify everything is connected
```bash
curl http://localhost:8000/api/health
```
A healthy stack returns:
```json
{"status":"ok","model":"qwen2.5:7b","provider":"ollama","llm_base_url":"http://host.docker.internal:11434","services":{"chromadb":"ok","mongodb":"ok"}}
```
Then open http://localhost:3000 and ask the copilot something, e.g. *"Phone won't charge, where do I start?"*

> **Before a demo:** send one question first. The model loads into RAM on its first request, and `LLM_KEEP_ALIVE` (default `30m`) keeps it there between questions.

### Stopping and resetting
Stop the stack (data is kept):
```bash
docker compose down
```
Stop and **delete all stored data** (ChromaDB vectors and MongoDB):
```bash
docker compose down -v
```
After pulling new code, rebuild:
```bash
docker compose up -d --build
```

---

## 💻 Local Development (without Docker)

Run the backend and frontend directly for hot reload. Ollama must be running on the host.

**Backend** (from `backend/`):
```bash
python -m venv .venv
```
```bash
source .venv/bin/activate
```
(Windows PowerShell: `.venv\Scripts\Activate.ps1`)
```bash
pip install -r requirements.txt
```
```bash
uvicorn main:app --reload --port 8000
```
Without `CHROMA_HOST` set, the backend uses an embedded ChromaDB in `backend/chroma_data/`. MongoDB is optional for local development; `/api/health` will report it as unreachable if it isn't running.

**Frontend** (from the repo root):
```bash
npm install
```
```bash
npm run dev
```
Open http://localhost:3000. The frontend calls `http://localhost:8000` unless `NEXT_PUBLIC_API_URL` is set.

---

## ⚙️ Configuration

All settings live in `.env` (read by Docker Compose) or as environment variables when running locally.

| Variable | Default | Purpose |
|---|---|---|
| `FRONTEND_PORT` / `BACKEND_PORT` | `3000` / `8000` | Host ports for the UI and API |
| `CHROMA_HOST_PORT` / `MONGO_HOST_PORT` | `8001` / `27017` | Host ports for the databases |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend URL used by the browser. Built into the frontend, so rebuild after changing it |
| `CORS_ORIGINS` | `http://localhost:3000,…` | Origins allowed to call the API |
| `LLM_PROVIDER` | `ollama` | `ollama` or `openai` (OpenAI-compatible servers such as Lemonade) |
| `LLM_BASE_URL` | `http://host.docker.internal:11434` | LLM server address, as seen from the backend container |
| `LLM_MODEL` | `qwen2.5:7b` | Model name on the LLM server |
| `LLM_TEMPERATURE` | `0.2` | Sampling temperature |
| `LLM_KEEP_ALIVE` | `30m` | How long Ollama keeps the model loaded between requests |
| `CHROMA_VERSION` / `CHROMA_COLLECTION` | `1.5.9` / `repair_manuals` | ChromaDB image tag and collection name |
| `MONGO_VERSION`, `MONGO_ROOT_USER`, `MONGO_ROOT_PASSWORD`, `MONGO_DB` | `8.0`, `openforge`, `change-me`, `openforge` | MongoDB image and credentials |

After changing backend settings, restart it with `docker compose up -d backend`. After changing `NEXT_PUBLIC_API_URL`, rebuild the frontend with `docker compose up -d --build frontend`.

### Using AMD Lemonade
Lemonade serves an OpenAI-compatible API, by default on port **8000**, which clashes with the backend. In `.env`:
```
BACKEND_PORT=8080
NEXT_PUBLIC_API_URL=http://localhost:8080
LLM_PROVIDER=openai
LLM_BASE_URL=http://host.docker.internal:8000/api/v1
LLM_MODEL=<model name loaded in Lemonade>
```
Then rebuild:
```bash
docker compose up -d --build
```

---

## 🔌 API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Model info and ChromaDB/MongoDB connectivity |
| `POST` | `/api/chat` | Returns the full answer as one JSON response |
| `POST` | `/api/chat/stream` | Streams newline-delimited JSON events (used by the Bench UI) |

Request body for both chat endpoints:
```json
{
  "message": "PP3V3_S2 reads 2.4V, what should it be?",
  "session": {
    "device_model": "Pixel 7",
    "current_step": "Measure main rail",
    "active_schematic": "logic-board-rev-b",
    "history": [{ "role": "technician", "content": "..." }, { "role": "copilot", "content": "..." }]
  }
}
```

Stream events, one JSON object per line:
```
{"type": "route",   "route": "schematic_rag", "issue": "..."}
{"type": "sources", "sources": [{"source": "...", "page": 18, "text": "...", "score": 0.4}]}
{"type": "token",   "text": "..."}
{"type": "done",    "reply": "...", "trace": ["triage", "schematic_rag", "respond"]}
{"type": "error",   "detail": "..."}
```

---

## 🧩 Adding a Specialist Agent

Agents are registered in `backend/agents/__init__.py`. Nothing in `graph.py` needs to change.

1. Create `backend/agents/<name>.py` with a node function `(state: AgentState) -> dict` that returns partial state updates (e.g. `{"context": [...], "trace": ["<name>"]}`).
2. Add a `Specialist(name=..., node=..., description=...)` entry to `SPECIALISTS`. The `description` is shown to the TriageAgent, so state plainly when it should route there.
3. Optionally add a status label for the route in `ROUTE_STATUS` in `components/ChatPanel.tsx`.

---

## 🩺 Troubleshooting

| Symptom | Fix |
|---|---|
| Chat shows *"model '…' not found"* | Pull the model on the host: `ollama pull <LLM_MODEL>` |
| Chat shows *"Local model unavailable at …"* | Start Ollama/Lemonade on the host and check `LLM_BASE_URL` |
| Chat shows *"Backend unreachable"* | Check `docker compose ps`; the backend must be `healthy` |
| First answer is very slow | The model is loading into RAM; later answers are faster while `LLM_KEEP_ALIVE` holds it |
| Backend can't reach Ollama under native Docker in WSL2 | Make Ollama listen on all interfaces: set `OLLAMA_HOST=0.0.0.0` on the host and restart Ollama |
| CORS errors in the browser console | Add the UI's origin to `CORS_ORIGINS` and restart the backend |
| Port already in use | Change the matching `*_PORT` variable in `.env` |
| Old chat history after a restart | Use the reset button in the Bench UI header (history is stored in the browser) |

---

## 🤝 Contributing
OpenForge Edge is built for the community. Whether you are adding new schematic OCR parsers, optimizing the LangGraph prompts for specific device triages, or improving the Next.js UI, contributions are welcome. Please check our `CONTRIBUTING.md` for guidelines.

## 📄 License
This project is licensed under the MIT License - see the `LICENSE` file for details.

*Developed by Lapis Forge.*
