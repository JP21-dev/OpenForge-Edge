"""Pulls a device's public repair guides from iFixit into the local knowledge
base. Needs internet only while pulling; the text is stored in MongoDB and
indexed in ChromaDB, so it works offline afterwards. iFixit guides are
CC BY-NC-SA: keep them on this bench and credit iFixit."""

import json
import logging
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from db import db, now
from ingest import chunk, sections, store_pieces
from knowledge import ANY_REV, collection, device_slug

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/knowledge/ifixit", tags=["ifixit"])

API = "https://www.ifixit.com/api/2.0"
HEADERS = {"User-Agent": "OpenForgeEdge/0.2 (offline repair bench; pulls guides on request)"}
PRIORITY = re.compile(r"motherboard|logic board|mainboard|battery|charging|port|power|fan|heat ?sink|ssd|screen|display|hdmi", re.I)
LICENSE = "iFixit, CC BY-NC-SA"


class PullRequest(BaseModel):
    device_model: str = Field(min_length=1, max_length=80)
    ifixit_device: str = Field(min_length=1, max_length=120)
    max_guides: int = Field(default=8, ge=1, le=20)


class IfixitUnavailable(RuntimeError):
    pass


def _get(path: str) -> dict:
    url = f"{API}/{path}"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=30) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError:
        raise
    except Exception as exc:
        raise IfixitUnavailable(f"Could not reach iFixit ({exc}). Pulling guides needs an internet connection.") from exc


def _category(name: str) -> tuple[dict | None, list[str]]:
    try:
        return _get(f"wikis/CATEGORY/{urllib.parse.quote(name)}"), []
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            raise IfixitUnavailable(f"iFixit returned HTTP {exc.code}") from exc
    found = _get(f"search/{urllib.parse.quote(name)}?filter=category&limit=6").get("results", [])
    titles = [r.get("title") or r.get("display_title") for r in found if r.get("title") or r.get("display_title")]
    if not titles:
        return None, []
    try:
        return _get(f"wikis/CATEGORY/{urllib.parse.quote(titles[0])}"), titles
    except urllib.error.HTTPError:
        return None, titles


def _rank(guide: dict) -> tuple[int, str]:
    kind = guide.get("type", "")
    title = guide.get("title", "")
    if kind == "teardown":
        return 0, title
    if kind == "replacement" and PRIORITY.search(title):
        return 1, title
    if kind == "disassembly":
        return 2, title
    if kind == "replacement":
        return 3, title
    return 9, title


def _clean(text: str) -> str:
    text = re.sub(r"\[(?:link|product|guide|new_window)\|[^|\]]*\|([^\]]*)\]", r"\1", text or "")
    text = re.sub(r"\[[a-z_]+\|([^\]|]*)\]", r"\1", text)
    text = re.sub(r"'{2,3}", "", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def _guide_text(guide: dict) -> str:
    lines = [f"# {guide.get('title', '')}"]
    tools = [t.get("text") for t in guide.get("tools", []) if t.get("text")]
    if tools:
        lines.append(f"Tools: {', '.join(tools)}")
    if guide.get("introduction_raw"):
        lines.append(_clean(guide["introduction_raw"]))
    for i, step in enumerate(guide.get("steps", []), start=1):
        title = _clean(step.get("title", ""))
        lines.append(f"\n## Step {i}{f': {title}' if title else ''}")
        for line in step.get("lines", []):
            text = _clean(line.get("text_raw", ""))
            if text:
                indent = "  " * max(int(line.get("level", 0) or 0), 0)
                lines.append(f"{indent}- {text}")
    if guide.get("conclusion_raw"):
        lines.append("\n## Conclusion\n" + _clean(guide["conclusion_raw"]))
    return "\n".join(lines)


def index_doc(doc: dict) -> int:
    pieces = []
    for title, body in sections(doc["text"]):
        for part in chunk(body):
            label = " — ".join(t for t in (doc["title"], title) if t)
            pieces.append({"text": f"{label}\n{part}", "section": title, "page": 0})
    base = {
        "device": doc["device"],
        "board_rev": ANY_REV,
        "source": f"iFixit: {doc['title']}",
        "doc_type": "ifixit-guide",
        "ifixit_id": doc["guideid"],
        "board": "",
        "url": doc["url"],
        "reliability": f"community guide ({LICENSE})",
    }
    store_pieces(f"ifixit:{doc['guideid']}:{doc['device']}", base, pieces,
                 replace={"$and": [{"ifixit_id": doc["guideid"]}, {"device": doc["device"]}]})
    return len(pieces)


def _pull(req: PullRequest) -> dict:
    device = device_slug(req.device_model)
    category, suggestions = _category(req.ifixit_device.strip())
    if not category:
        hint = f" Try: {', '.join(suggestions)}." if suggestions else ""
        raise HTTPException(404, f"iFixit has no device page called \"{req.ifixit_device}\".{hint}")

    guides = sorted((g for g in category.get("guides", []) if _rank(g)[0] < 9), key=_rank)
    picked, seen = [], set()
    for g in guides:
        key = re.sub(r"^\(new\)\s*", "", g.get("title", "").lower())
        if key in seen:
            continue
        seen.add(key)
        picked.append(g)
        if len(picked) >= req.max_guides:
            break

    pulled, chunks = [], 0
    for g in picked:
        time.sleep(0.4)
        full = _get(f"guides/{g['guideid']}")
        doc = {
            "_id": f"ifixit-{g['guideid']}-{device}",
            "device": device,
            "device_model": req.device_model.strip(),
            "ifixit_device": category.get("title") or req.ifixit_device,
            "guideid": g["guideid"],
            "title": full.get("title") or g.get("title"),
            "type": full.get("type") or g.get("type"),
            "url": full.get("url") or f"https://www.ifixit.com/Guide/{g['guideid']}",
            "license": LICENSE,
            "text": _guide_text(full),
            "steps": len(full.get("steps", [])),
            "fetched_at": now(),
        }
        db().external_docs.replace_one({"_id": doc["_id"]}, doc, upsert=True)
        chunks += index_doc(doc)
        pulled.append({k: doc[k] for k in ("guideid", "title", "type", "url", "steps")})
    return {"ifixit_device": category.get("title"), "guides": pulled, "chunks": chunks, "suggestions": suggestions}


@router.post("")
async def pull(req: PullRequest) -> dict:
    try:
        return await run_in_threadpool(_pull, req)
    except IfixitUnavailable as exc:
        raise HTTPException(502, str(exc)) from exc


@router.get("")
def list_pulled(device_model: str) -> list[dict]:
    docs = db().external_docs.find({"device": device_slug(device_model)}, {"text": 0}).sort("fetched_at", -1)
    return [{**{k: v for k, v in d.items() if k != "_id"}, "id": d["_id"]} for d in docs]


@router.delete("/{doc_id}")
def delete_pulled(doc_id: str) -> dict:
    doc = db().external_docs.find_one({"_id": doc_id})
    if not doc:
        raise HTTPException(404, "Guide not found")
    collection().delete(where={"$and": [{"ifixit_id": doc["guideid"]}, {"device": doc["device"]}]})
    db().external_docs.delete_one({"_id": doc_id})
    return {"deleted": doc_id}


def reindex_all() -> int:
    return sum(index_doc(d) for d in db().external_docs.find({}))
