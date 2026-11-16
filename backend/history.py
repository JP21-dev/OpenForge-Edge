import logging
import uuid
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db import db, now, public
from knowledge import ANY_REV, board_rev, check_embedding, device_slug, embed_documents, history_collection

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/repairs", tags=["repairs"])


class RepairReading(BaseModel):
    test_point: str = Field(max_length=120)
    mode: str = Field(max_length=10)
    value: float | None = None
    unit: str = Field(default="", max_length=5)
    expected_min: float | None = None
    expected_max: float | None = None
    status: Literal["ok", "fault", "unknown"] = "unknown"


class RepairStep(BaseModel):
    title: str = Field(max_length=200)
    status: str = Field(max_length=20)


class RepairIn(BaseModel):
    device_model: str = Field(min_length=1, max_length=80)
    board_revision: str = Field(default="", max_length=40)
    symptom: str = Field(min_length=1, max_length=500)
    outcome: Literal["fixed", "not_fixed", "parked"]
    root_cause: str = Field(default="", max_length=1000)
    fix: str = Field(default="", max_length=2000)
    parts: str = Field(default="", max_length=500)
    readings: list[RepairReading] = Field(default_factory=list, max_length=50)
    steps: list[RepairStep] = Field(default_factory=list, max_length=50)
    message_count: int = 0


OUTCOME_LABEL = {"fixed": "fixed", "not_fixed": "not fixed", "parked": "parked"}


def _summary_text(doc: dict) -> str:
    lines = [
        f"Device: {doc['device_model']}" + (f" board {doc['board_rev']}" if doc["board_rev"] != ANY_REV else ""),
        f"Symptom: {doc['symptom']}",
        f"Outcome: {OUTCOME_LABEL[doc['outcome']]}",
    ]
    if doc["root_cause"]:
        lines.append(f"Root cause: {doc['root_cause']}")
    if doc["fix"]:
        lines.append(f"Fix: {doc['fix']}")
    if doc["parts"]:
        lines.append(f"Parts replaced: {doc['parts']}")
    faults = [r for r in doc["readings"] if r["status"] == "fault"]
    if faults:
        shown = ", ".join(f"{r['test_point']} {r['value']} {r['unit']}".strip() for r in faults[:6])
        lines.append(f"Out-of-range readings: {shown}")
    return "\n".join(lines)


def _index(doc: dict) -> None:
    col = history_collection()
    check_embedding(col)
    text = _summary_text(doc)
    col.upsert(
        ids=[doc["_id"]],
        documents=[text],
        embeddings=embed_documents([text]),
        metadatas=[
            {
                "device": doc["device"] or "",
                "board_rev": doc["board_rev"],
                "outcome": OUTCOME_LABEL[doc["outcome"]],
                "date": doc["created_at"][:10],
            }
        ],
    )


def _out(doc: dict) -> dict:
    out = public(doc)
    out["board_rev"] = None if out.get("board_rev") == ANY_REV else out.get("board_rev")
    return out


@router.post("")
def save_repair(body: RepairIn) -> dict:
    doc = {
        "_id": uuid.uuid4().hex,
        "device": device_slug(body.device_model),
        "device_model": body.device_model.strip(),
        "board_rev": board_rev(body.board_revision),
        "symptom": body.symptom.strip(),
        "outcome": body.outcome,
        "root_cause": body.root_cause.strip(),
        "fix": body.fix.strip(),
        "parts": body.parts.strip(),
        "readings": [r.model_dump() for r in body.readings],
        "steps": [s.model_dump() for s in body.steps],
        "message_count": body.message_count,
        "created_at": now(),
    }
    db().repairs.insert_one(doc)
    try:
        _index(doc)
    except Exception as exc:
        log.warning("Saved repair %s but could not index it for search: %s", doc["_id"], exc)
    return _out(doc)


@router.get("")
def list_repairs(device_model: str | None = None, limit: int = 50) -> list[dict]:
    query = {"device": device_slug(device_model)} if device_model else {}
    docs = db().repairs.find(query, {"readings": 0, "steps": 0}).sort("created_at", -1).limit(min(limit, 200))
    return [_out(d) for d in docs]


@router.delete("/{repair_id}")
def delete_repair(repair_id: str) -> dict:
    if not db().repairs.delete_one({"_id": repair_id}).deleted_count:
        raise HTTPException(404, "Repair not found")
    try:
        history_collection().delete(ids=[repair_id])
    except Exception as exc:
        log.warning("Could not remove repair %s from the search index: %s", repair_id, exc)
    return {"deleted": repair_id}


def reindex_all() -> int:
    docs = list(db().repairs.find({}))
    for doc in docs:
        _index(doc)
    return len(docs)
