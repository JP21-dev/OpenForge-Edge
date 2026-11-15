# OpenForge Edge 🛠️
**Offline-First Multimodal AI Copilot for Hardware Repair & Diagnostics**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.103-009688.svg)](https://fastapi.tiangolo.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Multi--Agent-orange)](https://python.langchain.com/docs/langgraph)

OpenForge Edge (formerly Forge Assist) is a zero-trust, offline-first multimodal AI copilot designed for hardware repair technicians, micro-soldering specialists, and the Right-to-Repair community. 

Built to run entirely on local edge devices, OpenForge Edge removes the reliance on expensive cloud API tokens and ensures absolute customer data privacy at the repair bench. By leveraging multi-agent routing and local RAG, it provides technicians with interactive board diagnostics, real-time multimeter HUDs, and guided training workflows without ever sending proprietary schematics or customer details to the cloud.

---

## 🚀 Key Features

*   **Zero-Trust Edge Inference:** Runs 100% offline using local LLMs (e.g., `llama3.2:3b`) and vision models, ensuring customer data privacy and eliminating cloud compute costs.
*   **Multimeter HUD & Diode Testing:** Real-time visual overlays for board diagnostics and diode test points.
*   **Interactive Screw Maps:** Step-by-step visual teardown tracking to prevent hardware mix-ups during complex repairs.
*   **Computer Vision Ingestion Pipeline:** Automated OCR pipeline that processes XZZ schematic screenshots and converts them into structured JSON data for the local vector database.
*   **Local RAG for Repair Manuals:** Instant semantic search across thousands of repair guides, schematics, and component datasheets powered by ChromaDB.

---

## 🏗️ Architecture & Tech Stack

OpenForge Edge utilizes a decoupled, containerized architecture optimized for local execution via WSL2 and Docker.

### Frontend (The Bench UI)
*   **Framework:** Next.js & React
*   **Styling:** Tailwind CSS
*   **State Management:** Zustand

### Backend (Multi-Agent Routing)
*   **API:** FastAPI (running via Uvicorn)
*   **Agent Framework:** LangGraph for dynamic task routing (e.g., triage, diagnostic querying, schematic retrieval)
*   **Local AI Engine:** Ollama / AMD Lemonade integration (`llama3.2:3b`, `nomic-embed-text`)

### Data Layer
*   **Document Store:** MongoDB
*   **Vector Database:** ChromaDB

---

## 🛠️ Getting Started

### Prerequisites
*   Windows 11 with WSL2 enabled (or native Linux environment)
*   Docker Desktop & Docker Compose
*   Node.js 20+
*   Python 3.11+

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/JP21-dev/openforge-edge.git
   cd openforge-edge
   ```

2. **Configure Environment Variables:**
   Copy the example environment file and configure your local ports to avoid collisions (default ChromaDB on 8001, FastAPI on 8000).
   ```bash
   cp .env.example .env
   ```
   *(Note: Ensure all proprietary service manuals or specific enterprise network configs are sanitized from your `.env` before running)*.

3. **Launch the Containerized Stack:**
   ```bash
   docker compose up -d
   ```

4. **Start the Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## 🤝 Contributing
OpenForge Edge is built for the community. Whether you are adding new schematic OCR parsers, optimizing the LangGraph prompts for specific device triages, or improving the Next.js UI, contributions are welcome. Please check our `CONTRIBUTING.md` for guidelines.

## 📄 License
This project is licensed under the MIT License - see the `LICENSE` file for details. 

*Developed by Lapis Forge.*
