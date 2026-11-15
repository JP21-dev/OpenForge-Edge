import json
import logging
from typing import AsyncIterator, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage
from pydantic import BaseModel, Field

import knowledge
from config import settings
from graph import repair_graph

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("openforge")

app = FastAPI(title="OpenForge Edge", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HistoryMessage(BaseModel):
    role: Literal["technician", "copilot"]
    content: str


class SessionState(BaseModel):
    session_id: str | None = None
    device_model: str | None = None
    current_step: str | None = None
    active_schematic: str | None = None
    history: list[HistoryMessage] = Field(default_factory=list, max_length=50)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    session: SessionState = Field(default_factory=SessionState)


class Source(BaseModel):
    source: str
    page: int | None
    text: str
    score: float


class ChatResponse(BaseModel):
    reply: str
    issue: str
    route: str
    sources: list[Source]
    trace: list[str]


def _check(fn) -> str:
    try:
        fn()
        return "ok"
    except Exception as exc:
        return f"unreachable: {exc.__class__.__name__}"


def _ping_mongo() -> None:
    from pymongo import MongoClient

    with MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=1500) as client:
        client.admin.command("ping")


def _knowledge() -> tuple[int | None, str | None]:
    try:
        col = knowledge.collection()
        return col.count(), (col.metadata or {}).get("embedding")
    except Exception:
        return None, None


@app.get("/api/health")
def health() -> dict:
    chunks, built_with = _knowledge()
    return {
        "status": "ok",
        "model": settings.llm_model,
        "provider": settings.llm_provider,
        "llm_base_url": settings.llm_base_url,
        "embedding": knowledge.embedding_id(),
        "knowledge_chunks": chunks,
        "knowledge_built_with": built_with,
        "services": {
            "chromadb": "ok" if chunks is not None else "unreachable",
            "mongodb": _check(_ping_mongo),
        },
    }


def _initial_state(req: ChatRequest) -> dict:
    history = [
        HumanMessage(m.content) if m.role == "technician" else AIMessage(m.content)
        for m in req.session.history
    ]
    return {
        "messages": [*history, HumanMessage(req.message)],
        "session": req.session.model_dump(exclude={"history", "session_id"}, exclude_none=True),
        "context": [],
        "trace": [],
    }


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    initial = _initial_state(req)

    try:
        result = await repair_graph.ainvoke(initial)
    except Exception as exc:
        log.exception("Graph run failed")
        raise HTTPException(
            status_code=503,
            detail=f"Local model unavailable at {settings.llm_base_url}: {exc}",
        ) from exc

    return ChatResponse(
        reply=result["reply"],
        issue=result.get("issue", ""),
        route=result.get("route", ""),
        sources=result.get("context", []),
        trace=result.get("trace", []),
    )


def _event(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False) + "\n"


async def _stream_events(req: ChatRequest) -> AsyncIterator[str]:
    trace: list[str] = []
    try:
        async for mode, data in repair_graph.astream(
            _initial_state(req), stream_mode=["updates", "messages"]
        ):
            if mode == "messages":
                chunk, meta = data
                if "internal" in (meta.get("tags") or []):
                    continue
                if meta.get("langgraph_node") == "respond" and isinstance(chunk, AIMessageChunk):
                    if chunk.content:
                        yield _event({"type": "token", "text": chunk.content})
                continue

            for update in data.values():
                trace.extend(update.get("trace", []))
                if "route" in update:
                    yield _event({"type": "route", "route": update["route"], "issue": update.get("issue", "")})
                if update.get("context"):
                    yield _event({"type": "sources", "sources": update["context"]})
                if "reply" in update:
                    yield _event({"type": "done", "reply": update["reply"], "trace": trace})
    except Exception as exc:
        log.exception("Streaming graph run failed")
        yield _event({"type": "error", "detail": f"Local model unavailable at {settings.llm_base_url}: {exc}"})


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    return StreamingResponse(
        _stream_events(req),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
