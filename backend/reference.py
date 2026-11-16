import re
import uuid
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from db import db, now, public
from knowledge import ANY_REV, board_rev, device_slug

router = APIRouter(prefix="/api", tags=["reference"])

MeterMode = Literal["DCV", "ACV", "OHM", "DIODE", "CONT", "AMP"]


class ReferenceIn(BaseModel):
    device_model: str = Field(min_length=1, max_length=80)
    board_revision: str = Field(default="", max_length=40)
    test_point: str = Field(min_length=1, max_length=120)
    mode: MeterMode
    unit: str = Field(default="", max_length=5)
    expected_min: float
    expected_max: float
    source: str = Field(default="", max_length=120)
    note: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def _order(self):
        if self.expected_min > self.expected_max:
            self.expected_min, self.expected_max = self.expected_max, self.expected_min
        return self


def _out(doc: dict) -> dict:
    out = public(doc)
    out["board_rev"] = None if out.get("board_rev") == ANY_REV else out.get("board_rev")
    return out


def _scope(device_model: str | None, board_revision: str | None) -> dict:
    query: dict = {}
    if device_model:
        query["device"] = device_slug(device_model)
    if board_revision and board_rev(board_revision) != ANY_REV:
        query["board_rev"] = {"$in": [board_rev(board_revision), ANY_REV]}
    return query


def for_board(device: str | None, rev: str | None, limit: int = 60) -> list[dict]:
    if not device:
        return []
    query: dict = {"device": device}
    if rev and board_rev(rev) != ANY_REV:
        query["board_rev"] = {"$in": [board_rev(rev), ANY_REV]}
    return [_out(d) for d in db().reference_values.find(query).sort("test_point", 1).limit(limit)]


@router.get("/reference")
def list_reference(device_model: str | None = None, board_revision: str | None = None) -> list[dict]:
    docs = db().reference_values.find(_scope(device_model, board_revision)).sort("test_point", 1)
    return [_out(d) for d in docs]


@router.post("/reference")
def add_reference(body: ReferenceIn) -> dict:
    device = device_slug(body.device_model)
    rev = board_rev(body.board_revision)
    doc = {
        "device": device,
        "device_model": body.device_model.strip(),
        "board_rev": rev,
        "test_point": body.test_point.strip(),
        "mode": body.mode,
        "unit": body.unit,
        "expected_min": body.expected_min,
        "expected_max": body.expected_max,
        "source": body.source.strip(),
        "note": body.note.strip(),
        "updated_at": now(),
    }
    existing = db().reference_values.find_one(
        {"device": device, "board_rev": rev, "test_point": {"$regex": f"^{re.escape(doc['test_point'])}$", "$options": "i"}, "mode": body.mode}
    )
    if existing:
        db().reference_values.update_one({"_id": existing["_id"]}, {"$set": doc})
        doc["_id"] = existing["_id"]
    else:
        doc["_id"] = uuid.uuid4().hex
        doc["created_at"] = doc["updated_at"]
        db().reference_values.insert_one(doc)
    return _out(doc)


@router.delete("/reference/{ref_id}")
def delete_reference(ref_id: str) -> dict:
    if not db().reference_values.delete_one({"_id": ref_id}).deleted_count:
        raise HTTPException(404, "Reference value not found")
    return {"deleted": ref_id}


@router.get("/boards")
def list_boards(device_model: str) -> list[str]:
    device = device_slug(device_model)
    revs: set[str] = set()
    for name in ("schematics", "reference_values", "repairs"):
        revs.update(db()[name].distinct("board_rev", {"device": device}))
    revs.discard(ANY_REV)
    return sorted(r for r in revs if r)
