# OpenForge Edge 🛠️
**Offline-First Multimodal AI Copilot for Hardware Repair & Diagnostics**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Multi--Agent-orange)](https://langchain-ai.github.io/langgraph/)
[![AMD Lemonade](https://img.shields.io/badge/AMD-Lemonade%20Ready-ED1C24)](https://lemonade-server.ai)

OpenForge Edge (formerly Forge Assist) is a zero-trust, offline-first multimodal AI copilot designed for hardware repair technicians, micro-soldering specialists, and the Right-to-Repair community.

Built to run entirely on local edge devices, OpenForge Edge removes the reliance on expensive cloud API tokens and ensures absolute customer data privacy at the repair bench. By leveraging multi-agent routing and local RAG, it provides technicians with interactive board diagnostics, real-time multimeter HUDs, and guided training workflows without ever sending proprietary schematics or customer details to the cloud.

**Built for AMD Lemonade.** OpenForge Edge runs on [AMD Lemonade](https://lemonade-server.ai), AMD's local AI server, with one configuration file: chat, triage and manual embeddings all run through Lemonade's OpenAI-compatible API. On Ryzen AI 300-series laptops the copilot runs on the NPU and integrated GPU together (Hybrid models); on Radeon GPUs it runs through llama.cpp with Vulkan or ROCm. Ollama is supported as an alternative engine for non-AMD machines. See [AMD Lemonade Integration](#-amd-lemonade-integration).

---

## 🚀 Key Features

*   **Zero-Trust Edge Inference:** Runs 100% offline using local LLMs, ensuring customer data privacy and eliminating cloud compute costs.
*   **AMD Lemonade Ready:** Switch the whole AI stack (chat and embeddings) to Lemonade with `.env.lemonade.example` and a setup script. Runs on Ryzen AI NPU + iGPU (Hybrid) or Radeon GPUs; Ollama (`qwen2.5:7b`) remains available for other hardware.
*   **Streaming Bench Chat:** Large, high-contrast chat built for use mid-repair. Answers stream in as they are generated, with live agent status ("Triaging issue…", "Searching schematics…") and cited manual excerpts.
*   **Multimeter HUD & Diode Testing:** Log readings from any meter with large touch targets (test point, mode, value, optional expected range). Readings are flagged in/out of range and sent to the copilot, so you can ask "Is this reading bad?" or "What should I check next?".
*   **Interactive Screw Maps:** Step-by-step teardown tracking to prevent hardware mix-ups during complex repairs.
*   **Local RAG for Repair Manuals:** Ingest schematic PDFs, Markdown notes and JSON measurement files into ChromaDB with local `nomic-embed-text` embeddings. Answers cite the excerpts they used, and questions asking for a voltage, reading or resistance the knowledge base doesn't contain get "not in the knowledge base yet" instead of a guess.
*   **Computer Vision Ingestion Pipeline** *(planned)*: OCR pipeline that processes XZZ schematic screenshots into structured JSON for the vector database.

> **Current status:** the knowledge base ships with sourced PS5 notes (board revisions, known ICs, no-video and no-power diagnosis, original-PS5 teardown and screw map). Add your own schematics and boardview measurements to grow it. Readings are logged by hand in the HUD; live USB/Bluetooth meter input is planned.

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
*   **Local AI Engine:** AMD Lemonade (`LLM_PROVIDER=lemonade`, via the OpenAI-compatible API) or Ollama (`ChatOllama`). Embeddings use the same engine (`EMBED_PROVIDER`).

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
│   ├── knowledge.py        Embeddings, device detection, ChromaDB search
│   ├── ingest.py           Loads data/manuals into ChromaDB
│   ├── llm.py, config.py, state.py
│   └── requirements.txt
├── data/manuals/<device>/  Knowledge base source files (e.g. ps5/)
├── scripts/
│   ├── setup-lemonade.ps1  Lemonade setup for Windows
│   └── setup-lemonade.sh   Lemonade setup for Linux
├── Dockerfile.frontend
├── Dockerfile.backend
├── docker-compose.yml
├── .env.example            Ollama configuration (default)
└── .env.lemonade.example   AMD Lemonade configuration
```

---

## 🛠️ Getting Started

### Prerequisites
*   Windows 11 with WSL2 enabled (or a native Linux environment)
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/) with Docker Compose (WSL2 backend on Windows)
*   A local AI engine on the host: [AMD Lemonade](https://lemonade-server.ai) (see [AMD Lemonade Integration](#-amd-lemonade-integration)) or [Ollama](https://ollama.com/download). The steps below use Ollama; the Lemonade section replaces steps 2 and 3.
*   ~8 GB free disk space (models + Docker images); 16 GB RAM recommended for 7B models
*   A GPU with 6 GB+ VRAM is strongly recommended (developed on an RTX 2060 6 GB: answers start streaming in a few seconds). CPU-only laptops work but are several times slower.
*   For local development only: Node.js 20+ and Python 3.11+

### 1. Clone the repository
```bash
git clone https://github.com/JP21-dev/OpenForge-Edge.git
cd OpenForge-Edge
```

### 2. Install the local models
Start Ollama, then pull the chat model (~4.7 GB) and the embedding model (~274 MB):
```bash
ollama pull qwen2.5:7b
```
```bash
ollama pull nomic-embed-text
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

### 5. Load the knowledge base
Embed everything in `data/manuals/` into ChromaDB (takes a few seconds for the bundled PS5 notes):
```bash
docker compose exec backend python ingest.py
```
Run it again whenever you add or edit files. Use `--reset` to rebuild the collection from scratch. See [Knowledge Base](#-knowledge-base) for supported formats.

### 6. Verify everything is connected
```bash
curl http://localhost:8000/api/health
```
A healthy stack returns:
```json
{"status":"ok","model":"qwen2.5:7b","provider":"ollama","llm_base_url":"http://host.docker.internal:11434","embed_model":"nomic-embed-text","knowledge_chunks":14,"services":{"chromadb":"ok","mongodb":"ok"}}
```
`knowledge_chunks` should be above 0. Then open http://localhost:3000 and ask the copilot something, e.g. *"PS5 beeps 3 times when I plug it in"*.

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

## 📚 Knowledge Base

Source files live in `data/manuals/`, one subfolder per device family. The folder name becomes the `device` tag used to filter searches:
```
data/manuals/
└── ps5/
    ├── overview.md
    ├── no-power.md
    ├── no-video-hdmi.md
    ├── teardown-liquid-metal.md
    └── EDM-020-service-manual.pdf    (your own files)
```
The backend container mounts this folder read-only at `/app/manuals`.

**Supported formats**
*   **Markdown / text (`.md`, `.txt`):** split by `#`/`##`/`###` headings into chunks. Optional front matter adds metadata:
    ```
    ---
    title: PS5 no video / no HDMI signal
    device: ps5
    board: EDM-020
    type: procedure
    reliability: verified on bench
    url: https://example.com/source
    ---
    ```
*   **PDF (`.pdf`):** text is extracted page by page; answers cite the page number. Scanned PDFs without a text layer have nothing to extract (OCR is planned).
*   **JSON measurements (`.json`):** one chunk per entry, ideal for boardview readings from a known-good board:
    ```json
    {
      "title": "EDM-020 known-good readings",
      "board": "EDM-020",
      "entries": [
        { "name": "<rail or test point>", "kind": "voltage", "value": "<measured value>", "location": "<designator>", "notes": "measured on known-good board" }
      ]
    }
    ```

**Device detection:** a question is searched within a device's documents when the session's device name or the question mentions it (for PS5: "PS5", "PlayStation 5", "CFI-1…", "EDM-0…"). Add aliases for new devices in `DEVICE_ALIASES` in `backend/knowledge.py`.

**Private files:** PDFs under `data/manuals/` and any `data/manuals/**/private/` folder are git-ignored so proprietary schematics are never pushed. Markdown and JSON files are committed; keep only content you are allowed to share in them.

**Accuracy:** only add values you trust (service manuals, boardview, measurements from known-good boards). The copilot will repeat whatever is in the knowledge base.

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
| `LLM_PROVIDER` | `ollama` | `lemonade`, `ollama`, or `openai` (any other OpenAI-compatible server) |
| `LLM_BASE_URL` | `http://host.docker.internal:11434` | LLM server address, as seen from the backend container. Lemonade: `http://host.docker.internal:13305/api/v1` |
| `LLM_MODEL` | `qwen2.5:7b` | Model name on the LLM server (e.g. `Qwen2.5-7B-Instruct-Hybrid` on Lemonade) |
| `LLM_TEMPERATURE` | `0.2` | Sampling temperature |
| `LLM_API_KEY` | `lemonade` | Sent to OpenAI-compatible servers; set it to your `LEMONADE_API_KEY` if you enabled one |
| `LLM_JSON_MODE` | `true` | Request JSON output for triage; set `false` if the server rejects `response_format` |
| `LLM_ENABLE_THINKING` | `false` | Lemonade only: allow reasoning models (Qwen3) to think before answering. Slower |
| `LLM_KEEP_ALIVE` | `30m` | Ollama only: how long the model stays loaded between requests |
| `LLM_NUM_CTX` | `8192` | Ollama only: context window. Lemonade sizes the context itself (`lemonade config set ctx_size=…`) |
| `EMBED_PROVIDER` | `ollama` | `lemonade`, `ollama` or `openai`. Changing it requires `python ingest.py --reset` |
| `EMBED_BASE_URL` / `EMBED_MODEL` | `http://host.docker.internal:11434` / `nomic-embed-text` | Embedding server and model. Lemonade: `…:13305/api/v1` / `nomic-embed-text-v1-GGUF` |
| `EMBED_API_KEY` | `lemonade` | API key for an OpenAI-compatible embedding server |
| `RAG_TOP_K` | `4` | Maximum excerpts retrieved per question |
| `RAG_MIN_SCORE` | `0.6` | Minimum similarity (0–1) for an excerpt to be used; raise it if answers pull in unrelated sections |
| `CHROMA_VERSION` / `CHROMA_COLLECTION` | `1.5.9` / `repair_manuals` | ChromaDB image tag and collection name |
| `MONGO_VERSION`, `MONGO_ROOT_USER`, `MONGO_ROOT_PASSWORD`, `MONGO_DB` | `8.0`, `openforge`, `change-me`, `openforge` | MongoDB image and credentials |

After changing backend settings, restart it with `docker compose up -d backend`. After changing `NEXT_PUBLIC_API_URL`, rebuild the frontend with `docker compose up -d --build frontend`.

---

## 🍋 AMD Lemonade Integration

[Lemonade](https://lemonade-server.ai) is AMD's open-source local AI server. It serves LLMs and embedding models through an OpenAI-compatible API and is optimized for Ryzen AI NPUs, Radeon GPUs and Strix Halo. OpenForge Edge ships ready to run on it: no code changes, just configuration.

### Why Lemonade for the repair bench
*   **Runs on the NPU:** Ryzen AI 300-series laptops can run the copilot on the NPU and iGPU together (Hybrid models), leaving the CPU free for boardview software and keeping a bench laptop cool and quiet.
*   **Radeon acceleration:** On desktop Radeon GPUs, Lemonade's llama.cpp backend uses Vulkan or ROCm.
*   **One server for chat and embeddings:** triage, answers and the manuals knowledge base all use the same local server.
*   **Still fully offline:** after the models are downloaded, nothing leaves the machine.

### Choosing a model

| Hardware | Chat model (`LLM_MODEL`) | Notes |
|---|---|---|
| Ryzen AI 300 series, Windows | `Qwen2.5-7B-Instruct-Hybrid` | NPU + iGPU. Default in `.env.lemonade.example` |
| Ryzen AI 300 series, NPU only | `Qwen2.5-7B-Instruct-NPU` | Lowest power draw |
| Radeon GPU (Vulkan / ROCm) | `Qwen3-8B-GGUF` | Keep `LLM_ENABLE_THINKING=false` for fast answers |
| Smaller GPU or CPU only | `Qwen3-4B-Instruct-2507-GGUF` | ~2.5 GB |

Embeddings use `nomic-embed-text-v1-GGUF` on all hardware. Run `lemonade list` to see every model Lemonade offers and `lemonade backends` to see what your machine supports.

### Setup

**1. Install Lemonade** from [lemonade-server.ai](https://lemonade-server.ai) (Windows installer, or packages for Ubuntu, Debian, Fedora, Arch and Snap) and start it. Check it is serving:
```bash
curl http://localhost:13305/api/v1/models
```

**2. Run the setup script** from the repository root. It copies `.env.lemonade.example` to `.env` (if you don't already have one), pulls the chat and embedding models with `lemonade pull`, and checks the server.

Windows (PowerShell):
```powershell
.\scripts\setup-lemonade.ps1
```
Linux:
```bash
./scripts/setup-lemonade.sh
```

To set up by hand instead: copy `.env.lemonade.example` to `.env`, pick `LLM_MODEL` from the table above, and run `lemonade pull <model>` for the chat model and `nomic-embed-text-v1-GGUF`.

**3. Start the stack and build the knowledge base** with Lemonade embeddings:
```bash
docker compose up -d --build
```
```bash
docker compose exec backend python ingest.py --reset
```

**4. Verify:**
```bash
curl http://localhost:8000/api/health
```
Expect `"provider":"lemonade"`, `"embedding":"lemonade:nomic-embed-text-v1-GGUF"` and `knowledge_built_with` showing the same value.

### How the integration works
*   **Chat and triage:** with `LLM_PROVIDER=lemonade`, `backend/llm.py` uses LangChain's `ChatOpenAI` client pointed at `LLM_BASE_URL` (Lemonade's `/api/v1`). Streaming answers in the Bench UI come straight from Lemonade's streamed chat completions.
*   **Reasoning models:** Qwen3 models think before answering by default. The backend sends `enable_thinking: false` (Lemonade's request option) unless `LLM_ENABLE_THINKING=true`, so answers start streaming immediately.
*   **JSON triage:** triage asks for a JSON route decision. Lemonade's `response_format` support depends on the backend, so `.env.lemonade.example` sets `LLM_JSON_MODE=false` and relies on the prompt instead; the backend falls back to keyword routing if a reply isn't valid JSON.
*   **Embeddings:** with `EMBED_PROVIDER=lemonade`, `backend/knowledge.py` calls Lemonade's `/api/v1/embeddings` through the OpenAI client. The `search_document:` / `search_query:` prefixes that nomic models expect are added automatically.
*   **Embedding safety check:** the knowledge base records which provider and model built it. If you switch between Ollama and Lemonade without re-ingesting, ingest refuses to mix them and searches return no excerpts, with a log message telling you to run `python ingest.py --reset`.

### Docker networking
The backend container reaches Lemonade on the host at `host.docker.internal:13305`.
*   **Docker Desktop (Windows/macOS):** works with Lemonade's default `localhost` binding.
*   **Native Docker on Linux or inside WSL2:** the container comes from the Docker bridge, so make Lemonade listen on all interfaces and protect it with a key:
    ```bash
    lemonade config set host=0.0.0.0
    ```
    Set `LEMONADE_API_KEY` in Lemonade's environment, and put the same value in `LLM_API_KEY` and `EMBED_API_KEY` in `.env`.

### Older Lemonade releases
Older Lemonade versions listen on port **8000**, which clashes with the OpenForge backend. Either upgrade Lemonade, or keep it and move the backend: set `BACKEND_PORT=8080` and `NEXT_PUBLIC_API_URL=http://localhost:8080`, and change `13305` to `8000` in `LLM_BASE_URL` and `EMBED_BASE_URL`. Then rebuild with `docker compose up -d --build`.

### Switching back to Ollama
Copy `.env.example` to `.env` (or set `LLM_PROVIDER=ollama` and `EMBED_PROVIDER=ollama` with their URLs and models), then restart and re-ingest:
```bash
docker compose up -d backend
```
```bash
docker compose exec backend python ingest.py --reset
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
| Chat shows *"Local model unavailable at …"* | Start Lemonade/Ollama on the host and check `LLM_BASE_URL` |
| Lemonade returns a 404 or "model not found" | Pull it with `lemonade pull <LLM_MODEL>` and check the exact name with `lemonade list` |
| Lemonade errors mentioning `response_format` | Set `LLM_JSON_MODE=false` and restart the backend |
| Answers stop citing sources after switching engines | Embedding mismatch: run `docker compose exec backend python ingest.py --reset` |
| Backend can't reach Lemonade under native Docker in WSL2/Linux | `lemonade config set host=0.0.0.0` and set a `LEMONADE_API_KEY` (see [Docker networking](#docker-networking)) |
| Chat shows *"Backend unreachable"* | Check `docker compose ps`; the backend must be `healthy` |
| First answer is very slow | The model is loading into RAM; later answers are faster while `LLM_KEEP_ALIVE` holds it |
| Backend can't reach Ollama under native Docker in WSL2 | Make Ollama listen on all interfaces: set `OLLAMA_HOST=0.0.0.0` on the host and restart Ollama |
| CORS errors in the browser console | Add the UI's origin to `CORS_ORIGINS` and restart the backend |
| Port already in use | Change the matching `*_PORT` variable in `.env` |
| `knowledge_chunks` is `0` or answers never show sources | Run `docker compose exec backend python ingest.py` |
| Ingest fails with a model error | Pull the embedding model on the host: `ollama pull nomic-embed-text` |
| Answers say "not in the knowledge base yet" | The value isn't in `data/manuals/`. Add a trusted source and re-run ingest |
| Old chat history after a restart | Use the reset button in the Bench UI header (history is stored in the browser) |

---

## 🤝 Contributing
OpenForge Edge is built for the community. Whether you are adding new schematic OCR parsers, optimizing the LangGraph prompts for specific device triages, or improving the Next.js UI, contributions are welcome. Please check our `CONTRIBUTING.md` for guidelines.

## 📄 License
This project is licensed under the MIT License - see the `LICENSE` file for details.

*Developed by Lapis Forge.*
