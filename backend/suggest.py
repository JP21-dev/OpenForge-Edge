import json
import logging
import re

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field

import mode
import reference
from agents.responder import _format_context, _format_readings, _format_references
from knowledge import resolve_device, search, search_history
from db import db
from llm import get_llm

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/steps", tags=["steps"])

MAX_STEPS = 4

PROMPT = """You are helping an electronics repair technician who is working on a {device}{rev}.
Repair: {procedure}
Steps already completed: {completed}
The step that just FAILED: "{step}"{detail}
Technician's note about the failure: {note}

Logged meter readings (most recent first):
{readings}

Known-good reference values for this board:
{references}

Reference excerpts (manuals, schematics and past repairs on this bench):
{context}

Suggest the next {max_steps} or fewer diagnostic or repair steps that follow from this failure, most useful first.
Rules:
- Each step is one concrete action the technician can do at the bench now.
- Every step must address why "{step}" failed. Ignore excerpts about other symptoms or faults.
- Only mention part numbers, designators or values that appear in the excerpts, references or readings. Otherwise describe the check generically.
- Do not repeat steps already completed.
- Mention a safety hazard only when it applies (mains voltage inside a power supply, liquid metal, BGA rework).
- A title is at most 8 words. A detail is one or two short sentences.

Reply with only a JSON object:
{{"steps": [{{"title": "...", "detail": "...", "why": "<which excerpt, reading or past repair this comes from, or 'general practice'>"}}]}}"""


class FailedStep(BaseModel):
    title: str = Field(max_length=200)
    detail: str = Field(default="", max_length=600)


class SuggestRequest(BaseModel):
    device_model: str = Field(min_length=1, max_length=80)
    board_revision: str | None = Field(default=None, max_length=40)
    procedure: str = Field(default="", max_length=120)
    failed_step: FailedStep
    note: str = Field(default="", max_length=500)
    completed_steps: list[str] = Field(default_factory=list, max_length=60)
    readings: list[dict] = Field(default_factory=list, max_length=20)


class SuggestedStep(BaseModel):
    title: str
    detail: str = ""
    why: str = ""


class SuggestResponse(BaseModel):
    steps: list[SuggestedStep]
    patterns: list[SuggestedStep] = []
    sources: list[dict]


def _parse(text: str) -> list[SuggestedStep]:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return []
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return []
    steps = []
    for item in data.get("steps", [])[:MAX_STEPS]:
        if isinstance(item, dict) and str(item.get("title", "")).strip():
            steps.append(
                SuggestedStep(
                    title=str(item["title"]).strip()[:120],
                    detail=str(item.get("detail", "")).strip()[:400],
                    why=str(item.get("why", "")).strip()[:200],
                )
            )
    return steps


def _suggest(req: SuggestRequest) -> SuggestResponse:
    device = resolve_device(req.device_model, req.failed_step.title)
    query = " ".join(filter(None, [req.failed_step.title, "failed", req.note, req.procedure]))

    docs: list[dict] = []
    try:
        docs = search(query, device, rev=req.board_revision)
        docs += search_history(query, device, rev=req.board_revision)
    except Exception as exc:
        log.warning("Search for step suggestions failed: %s", exc)
    try:
        refs = reference.for_board(device, req.board_revision)
    except Exception:
        refs = []

    prompt = PROMPT.format(
        device=req.device_model,
        rev=f" (board {req.board_revision})" if req.board_revision else "",
        procedure=req.procedure or "unspecified",
        completed=", ".join(req.completed_steps) or "none",
        step=req.failed_step.title,
        detail=f" ({req.failed_step.detail})" if req.failed_step.detail else "",
        note=req.note or "(none)",
        readings=_format_readings(req.readings),
        references=_format_references(refs),
        context=_format_context(docs),
        max_steps=MAX_STEPS,
    )
    raw = get_llm(json_mode=True).invoke([HumanMessage(prompt)])
    steps = _parse(raw.content)
    for s in steps:
        s.why = _cite(s.why, docs)
    return SuggestResponse(steps=steps, patterns=_pattern_steps(docs), sources=docs)


def _pattern_steps(docs: list[dict]) -> list[SuggestedStep]:
    ids = [d["pattern_id"] for d in docs if d.get("pattern_id")]
    out = []
    for p in db().patterns.find({"_id": {"$in": ids}, "status": {"$ne": "dismissed"}}):
        detail = f"Seen in {p['count']} fixed repairs with a similar symptom."
        if p.get("fix"):
            detail += f" Usual fix: {p['fix']}"
        out.append(SuggestedStep(title=f"Check for: {p['root_cause']}"[:120], detail=detail[:400],
                                 why="verified pattern" if p.get("status") == "verified" else "auto-detected pattern"))
    return out


def _cite(why: str, docs: list[dict]) -> str:
    def name(match: re.Match) -> str:
        i = int(match.group(1)) - 1
        return docs[i]["source"] if 0 <= i < len(docs) else match.group(0)

    return re.sub(r"\[(\d+)\]", name, why)


@router.post("/suggest", response_model=SuggestResponse)
async def suggest(req: SuggestRequest) -> SuggestResponse:
    if mode.current() != "repair":
        raise HTTPException(409, "Ingest mode is on, so the chat model is unloaded. Switch to Repair mode for copilot suggestions.")
    try:
        return await run_in_threadpool(_suggest, req)
    except Exception as exc:
        log.exception("Step suggestion failed")
        raise HTTPException(503, f"Local model unavailable: {exc}") from exc
