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
graph TD
    subgraph Local_Edge [Offline Edge Environment - Docker / WSL2]
        
        subgraph Frontend [The Bench UI]
            Next[Next.js + Tailwind CSS]
            Zustand[Zustand State Management]
            Next <--> Zustand
        end

        subgraph Backend [Multi-Agent Routing]
            API[FastAPI / Uvicorn Server]
            LG[LangGraph Agent Orchestrator]
            API <-->|Tasks & State| LG
        end

        subgraph AI_Engine [AMD Lemonade Inference Engine]
            Llama[Llama 3.2:3B - Reasoning]
            Vision[Vision Model - Schematics OCR]
            Embed[nomic-embed-text - RAG]
        end

        subgraph Data_Layer [Local Data Stores]
            Mongo[(MongoDB - Repair Docs)]
            Chroma[(ChromaDB - Vector Embeddings)]
        end
        end

        subgraph Ingestion [Data Ingestion Pipeline]
        XZZ[XZZ Schematic Screenshots]
        end

        %% Connections
        Next <-->|JSON Requests| API
        LG <-->|LLM Inference & Tool Calls| AI_Engine
        LG <-->|Semantic Search| Chroma
        LG <-->|CRUD Operations| Mongo
    
        XZZ -->|Upload| Vision
        Vision -.->|Generate Structured JSON| API
