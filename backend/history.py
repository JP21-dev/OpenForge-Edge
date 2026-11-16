import logging
import math
import uuid
from collections import Counter
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from config import settings
from db import db, now, public
from knowledge import ANY_REV, board_rev, check_embedding, device_slug, embed_documents, history_collection

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/repairs", tags=["repairs"])
patterns_router = APIRouter(prefix="/api/patterns", tags=["patterns"])


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
                "kind": "repair",
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
    out = _out(doc)
    try:
        out["patterns"] = detect_patterns(doc["device"])
    except Exception as exc:
        log.warning("Pattern detection failed for %s: %s", doc["device"], exc)
        out["patterns"] = []
    return out


@router.get("")
def list_repairs(device_model: str | None = None, limit: int = 50) -> list[dict]:
    query = {"device": device_slug(device_model)} if device_model else {}
    docs = db().repairs.find(query, {"readings": 0, "steps": 0}).sort("created_at", -1).limit(min(limit, 200))
    return [_out(d) for d in docs]


@router.delete("/{repair_id}")
def delete_repair(repair_id: str) -> dict:
    doc = db().repairs.find_one({"_id": repair_id}, {"device": 1})
    if not doc or not db().repairs.delete_one({"_id": repair_id}).deleted_count:
        raise HTTPException(404, "Repair not found")
    try:
        history_collection().delete(ids=[repair_id])
    except Exception as exc:
        log.warning("Could not remove repair %s from the search index: %s", repair_id, exc)
    try:
        detect_patterns(doc["device"])
    except Exception as exc:
        log.warning("Pattern detection failed for %s: %s", doc["device"], exc)
    return {"deleted": repair_id}


def reindex_all() -> int:
    docs = list(db().repairs.find({}))
    for doc in docs:
        _index(doc)
    for device in db().repairs.distinct("device"):
        detect_patterns(device)
    return len(docs)


def _cos(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def _clusters(repairs: list[dict]) -> list[list[dict]]:
    texts = [r["symptom"] for r in repairs] + [r["root_cause"] for r in repairs]
    vecs = embed_documents(texts)
    sym, cause = vecs[: len(repairs)], vecs[len(repairs):]
    clusters: list[tuple[int, list[int]]] = []
    for i in range(len(repairs)):
        for seed, members in clusters:
            if _cos(sym[i], sym[seed]) >= settings.pattern_similarity and _cos(cause[i], cause[seed]) >= settings.pattern_similarity:
                members.append(i)
                break
        else:
            clusters.append((i, [i]))
    return [[repairs[i] for i in members] for _, members in clusters]


def _most_common(values: list[str]) -> str:
    values = [v for v in values if v]
    return Counter(values).most_common(1)[0][0] if values else ""


def _pattern_text(p: dict) -> str:
    revs = ", ".join(r for r in p["revisions"] if r != ANY_REV)
    lines = [
        f"Recurring pattern on {p['device_model']} ({p['count']} fixed repairs{f', boards {revs}' if revs else ''}):",
        f"Symptom: {p['symptom']}",
        f"Usual root cause: {p['root_cause']}",
    ]
    if p["fix"]:
        lines.append(f"Usual fix: {p['fix']}")
    if p["parts"]:
        lines.append(f"Parts replaced: {p['parts']}")
    return "\n".join(lines)


def detect_patterns(device: str | None) -> list[dict]:
    if not device:
        return []
    repairs = list(
        db().repairs.find({"device": device, "outcome": "fixed", "root_cause": {"$ne": ""}}).sort("created_at", 1).limit(300)
    )
    found = [c for c in (_clusters(repairs) if repairs else []) if len(c) >= settings.pattern_min_repairs]
    existing = list(db().patterns.find({"device": device}))
    used: set[str] = set()
    active: list[dict] = []

    for members in found:
        ids = [m["_id"] for m in members]
        match = max(existing, key=lambda p: len(set(p["repair_ids"]) & set(ids)), default=None)
        if match and set(match["repair_ids"]) & set(ids) and match["_id"] not in used:
            pattern_id, status, created = match["_id"], match.get("status", "auto"), match.get("created_at", now())
        else:
            pattern_id, status, created = uuid.uuid4().hex, "auto", now()
        used.add(pattern_id)
        revs = sorted({m["board_rev"] for m in members})
        latest = members[-1]
        pattern = {
            "_id": pattern_id,
            "device": device,
            "device_model": latest["device_model"],
            "board_rev": revs[0] if len(revs) == 1 else ANY_REV,
            "revisions": revs,
            "symptom": _most_common([m["symptom"] for m in members]) or latest["symptom"],
            "root_cause": _most_common([m["root_cause"] for m in members]),
            "fix": _most_common([m["fix"] for m in members]),
            "parts": ", ".join(sorted({p.strip() for m in members for p in m.get("parts", "").split(",") if p.strip()})),
            "count": len(members),
            "repair_ids": ids,
            "status": status,
            "first_seen": members[0]["created_at"],
            "last_seen": latest["created_at"],
            "created_at": created,
            "updated_at": now(),
        }
        db().patterns.replace_one({"_id": pattern_id}, pattern, upsert=True)
        active.append(pattern)

    stale = [p["_id"] for p in existing if p["_id"] not in used and p.get("status") == "auto"]
    if stale:
        db().patterns.delete_many({"_id": {"$in": stale}})

    col = history_collection()
    old_ids = [f"pattern-{p['_id']}" for p in existing]
    if old_ids:
        col.delete(ids=old_ids)
    indexed = [p for p in db().patterns.find({"device": device, "status": {"$ne": "dismissed"}})]
    if indexed:
        texts = [_pattern_text(p) for p in indexed]
        col.upsert(
            ids=[f"pattern-{p['_id']}" for p in indexed],
            documents=texts,
            embeddings=embed_documents(texts),
            metadatas=[
                {
                    "device": device,
                    "board_rev": p["board_rev"],
                    "outcome": "pattern",
                    "date": p["last_seen"][:10],
                    "kind": "pattern",
                    "pattern_id": p["_id"],
                    "count": p["count"],
                    "status": p["status"],
                }
                for p in indexed
            ],
        )
    return [_pattern_out(p) for p in active]


def _pattern_out(doc: dict) -> dict:
    out = public(doc)
    out["board_rev"] = None if out.get("board_rev") == ANY_REV else out.get("board_rev")
    return out


@patterns_router.get("")
def list_patterns(device_model: str | None = None) -> list[dict]:
    query = {"device": device_slug(device_model)} if device_model else {}
    return [_pattern_out(p) for p in db().patterns.find(query).sort([("status", -1), ("count", -1)])]


class PatternStatus(BaseModel):
    status: Literal["auto", "verified", "dismissed"]


@patterns_router.post("/{pattern_id}/status")
def set_pattern_status(pattern_id: str, body: PatternStatus) -> dict:
    doc = db().patterns.find_one({"_id": pattern_id})
    if not doc:
        raise HTTPException(404, "Pattern not found")
    db().patterns.update_one({"_id": pattern_id}, {"$set": {"status": body.status, "updated_at": now()}})
    detect_patterns(doc["device"])
    return _pattern_out(db().patterns.find_one({"_id": pattern_id}))


@patterns_router.post("/rebuild")
def rebuild_patterns(device_model: str) -> list[dict]:
    return detect_patterns(device_slug(device_model))
