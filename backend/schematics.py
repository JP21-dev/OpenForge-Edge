import logging
import shutil
import tempfile
import threading
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from PIL import Image, ImageOps
from pydantic import BaseModel, Field

import mode
import vision
from config import settings
from db import db, now, public
from ingest import chunk, sections, store_pieces
from knowledge import ANY_REV, board_rev, collection, device_slug

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/schematics", tags=["schematics"])

STORE_SIDE = 3000
MAX_PAGES = 200
IMAGE_TYPES = {".png", ".jpg", ".jpeg", ".webp", ".heic", ".heif", ".bmp", ".tif", ".tiff"}

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:
    pass

_wake = threading.Event()


def _root(schematic_id: str) -> Path:
    return Path(settings.uploads_dir) / schematic_id


def _page_path(schematic_id: str, n: int) -> Path:
    return _root(schematic_id) / f"page-{n}.png"


def _save_page(img: Image.Image, path: Path) -> None:
    img = img.convert("RGB")
    scale = STORE_SIDE / max(img.size)
    if scale < 1:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    img.save(path, format="PNG", optimize=True)


def _render_pdf(src: Path, out_dir: Path, start: int) -> list[dict]:
    import pypdfium2 as pdfium

    pages = []
    pdf = pdfium.PdfDocument(src)
    try:
        for i in range(len(pdf)):
            if start + len(pages) > MAX_PAGES:
                break
            page = pdf[i]
            width, height = page.get_size()
            scale = min(4.0, STORE_SIDE / max(width, height))
            n = start + len(pages)
            _save_page(page.render(scale=scale).to_pil(), out_dir / f"page-{n}.png")
            text = page.get_textpage().get_text_range() or ""
            pages.append({"n": n, "status": "pending", "text": "", "text_layer": text.strip()[:6000]})
    finally:
        pdf.close()
    return pages


def _convert(files: list[tuple[str, Path]], out_dir: Path) -> list[dict]:
    pages: list[dict] = []
    for name, path in files:
        suffix = Path(name).suffix.lower()
        if suffix == ".pdf":
            pages += _render_pdf(path, out_dir, len(pages) + 1)
        elif suffix in IMAGE_TYPES:
            n = len(pages) + 1
            with Image.open(path) as img:
                _save_page(ImageOps.exif_transpose(img), out_dir / f"page-{n}.png")
            pages.append({"n": n, "status": "pending", "text": "", "text_layer": ""})
        else:
            raise ValueError(f"{name}: unsupported file type (use PDF or an image)")
        if len(pages) > MAX_PAGES:
            raise ValueError(f"More than {MAX_PAGES} pages in one upload")
    if not pages:
        raise ValueError("No pages found")
    return pages


async def _spool(upload: UploadFile, dest: Path) -> None:
    limit = settings.upload_max_mb * 1024 * 1024
    size = 0
    with dest.open("wb") as out:
        while chunk_bytes := await upload.read(1024 * 1024):
            size += len(chunk_bytes)
            if size > limit:
                raise HTTPException(413, f"{upload.filename} is larger than {settings.upload_max_mb} MB")
            out.write(chunk_bytes)


@router.post("")
async def upload(
    files: list[UploadFile] = File(...),
    title: str = Form(..., min_length=1, max_length=120),
    device_model: str = Form(..., min_length=1, max_length=80),
    board_revision: str = Form("", max_length=40),
    dense: bool = Form(False),
) -> dict:
    schematic_id = uuid.uuid4().hex
    out_dir = _root(schematic_id)
    out_dir.mkdir(parents=True)
    try:
        with tempfile.TemporaryDirectory() as tmp:
            spooled = []
            for i, f in enumerate(files):
                dest = Path(tmp) / f"upload-{i}"
                await _spool(f, dest)
                spooled.append((f.filename or f"file-{i}", dest))
            try:
                pages = await run_in_threadpool(_convert, spooled, out_dir)
            except Exception as exc:
                raise HTTPException(400, f"Could not read upload: {exc}") from exc
    except BaseException:
        shutil.rmtree(out_dir, ignore_errors=True)
        raise

    doc = {
        "_id": schematic_id,
        "title": title.strip(),
        "device": device_slug(device_model),
        "device_model": device_model.strip(),
        "board_rev": board_rev(board_revision),
        "dense": dense,
        "filenames": [f.filename for f in files],
        "status": "queued",
        "error": None,
        "pages": pages,
        "created_at": now(),
    }
    db().schematics.insert_one(doc)
    _wake.set()
    return summary(doc)


def summary(doc: dict) -> dict:
    out = public(doc)
    pages = out.pop("pages", [])
    out["page_count"] = len(pages)
    out["pages_done"] = sum(p["status"] == "done" for p in pages)
    out["pages_failed"] = sum(p["status"] == "error" for p in pages)
    out["board_rev"] = None if out.get("board_rev") == ANY_REV else out.get("board_rev")
    return out


def _get(schematic_id: str) -> dict:
    doc = db().schematics.find_one({"_id": schematic_id})
    if not doc:
        raise HTTPException(404, "Schematic not found")
    return doc


@router.get("")
def list_schematics(device_model: str | None = None, board_revision: str | None = None) -> list[dict]:
    query: dict = {}
    if device_model:
        query["device"] = device_slug(device_model)
    if board_revision and board_rev(board_revision) != ANY_REV:
        query["board_rev"] = {"$in": [board_rev(board_revision), ANY_REV]}
    projection = {"pages.text": 0, "pages.text_layer": 0}
    return [summary(d) for d in db().schematics.find(query, projection).sort("created_at", -1)]


@router.get("/{schematic_id}")
def get_schematic(schematic_id: str) -> dict:
    doc = _get(schematic_id)
    out = summary(doc)
    out["pages"] = [
        {"n": p["n"], "status": p["status"], "text": p.get("text", ""), "edited": p.get("edited", False), "error": p.get("error")}
        for p in doc["pages"]
    ]
    return out


@router.get("/{schematic_id}/pages/{n}/image")
def page_image(schematic_id: str, n: int) -> FileResponse:
    _get(schematic_id)
    path = _page_path(schematic_id, n)
    if not path.is_file():
        raise HTTPException(404, "Page not found")
    return FileResponse(path, media_type="image/png", headers={"Cache-Control": "private, max-age=86400"})


class PageEdit(BaseModel):
    text: str = Field(max_length=40000)


@router.put("/{schematic_id}/pages/{n}")
def edit_page(schematic_id: str, n: int, body: PageEdit) -> dict:
    doc = _get(schematic_id)
    if not any(p["n"] == n for p in doc["pages"]):
        raise HTTPException(404, "Page not found")
    db().schematics.update_one(
        {"_id": schematic_id, "pages.n": n},
        {"$set": {"pages.$.text": body.text, "pages.$.status": "done", "pages.$.edited": True, "pages.$.error": None}},
    )
    doc = _get(schematic_id)
    index_page(doc, n, body.text, edited=True)
    _refresh_status(schematic_id)
    return get_schematic(schematic_id)


@router.post("/{schematic_id}/pages/{n}/rescan")
def rescan_page(schematic_id: str, n: int) -> dict:
    _get(schematic_id)
    db().schematics.update_one(
        {"_id": schematic_id, "pages.n": n},
        {"$set": {"pages.$.status": "pending", "pages.$.edited": False, "pages.$.error": None, "status": "queued"}},
    )
    _wake.set()
    return get_schematic(schematic_id)


@router.post("/{schematic_id}/retry")
def retry(schematic_id: str) -> dict:
    doc = _get(schematic_id)
    for p in doc["pages"]:
        if p["status"] == "error":
            p["status"], p["error"] = "pending", None
    db().schematics.update_one({"_id": schematic_id}, {"$set": {"pages": doc["pages"], "status": "queued", "error": None}})
    _wake.set()
    return get_schematic(schematic_id)


@router.delete("/{schematic_id}")
def delete_schematic(schematic_id: str) -> dict:
    _get(schematic_id)
    collection().delete(where={"schematic_id": schematic_id})
    db().schematics.delete_one({"_id": schematic_id})
    shutil.rmtree(_root(schematic_id), ignore_errors=True)
    return {"deleted": schematic_id}


def index_page(doc: dict, n: int, text: str, edited: bool = False) -> int:
    page_key = {"$and": [{"schematic_id": doc["_id"]}, {"page": n}]}
    if not text.strip():
        collection().delete(where=page_key)
        return 0
    heading = f"{doc['title']} p.{n}"
    pieces = []
    for title, body in sections(text):
        for part in chunk(body):
            label = " — ".join(t for t in (heading, title) if t)
            pieces.append({"text": f"{label}\n{part}", "section": title, "page": n})
    base = {
        "device": doc["device"] or "",
        "board_rev": doc["board_rev"],
        "source": doc["title"],
        "doc_type": "schematic",
        "schematic_id": doc["_id"],
        "board": doc["board_rev"] if doc["board_rev"] != ANY_REV else "",
        "url": "",
        "reliability": "edited by technician" if edited else "vision transcription, verify against the sheet",
    }
    store_pieces(f"{doc['_id']}:p{n}", base, pieces, replace=page_key)
    return len(pieces)


def reindex_all() -> int:
    total = 0
    for doc in db().schematics.find({}):
        for p in doc["pages"]:
            if p["status"] == "done":
                total += index_page(doc, p["n"], p.get("text", ""), p.get("edited", False))
    return total


def _refresh_status(schematic_id: str) -> None:
    doc = db().schematics.find_one({"_id": schematic_id}, {"pages.status": 1})
    statuses = [p["status"] for p in doc["pages"]]
    if "pending" in statuses:
        status = "queued"
    elif "error" in statuses:
        status = "error"
    else:
        status = "done"
    db().schematics.update_one({"_id": schematic_id}, {"$set": {"status": status}})


def _process_page(doc: dict, page: dict) -> None:
    n = page["n"]
    with Image.open(_page_path(doc["_id"], n)) as img:
        img.load()
        regions = vision.tiles(img, 2 if doc.get("dense") else 1)
        device = doc.get("device_model") or doc.get("device") or "an unknown device"
        rev = doc["board_rev"] if doc["board_rev"] != ANY_REV else None
        parts = []
        for name, region in regions:
            text = vision.read_region(region, name, device, rev, page.get("text_layer", ""))
            parts.append(text if len(regions) == 1 else f"# Region: {name}\n{text}")
    text = "\n\n".join(parts)
    db().schematics.update_one(
        {"_id": doc["_id"], "pages.n": n},
        {"$set": {"pages.$.text": text, "pages.$.status": "done", "pages.$.error": None}},
    )
    index_page(doc, n, text)


def _next_job() -> tuple[dict, dict] | None:
    doc = db().schematics.find_one(
        {"status": {"$in": ["queued", "processing"]}, "pages.status": "pending"},
        sort=[("created_at", 1)],
    )
    if not doc:
        return None
    page = next(p for p in doc["pages"] if p["status"] == "pending")
    return doc, page


def _worker() -> None:
    while True:
        _wake.wait(timeout=5)
        _wake.clear()
        while mode.current() == "ingest":
            try:
                job = _next_job()
            except Exception as exc:
                log.warning("Schematic queue unavailable: %s", exc)
                break
            if not job:
                break
            doc, page = job
            db().schematics.update_one({"_id": doc["_id"]}, {"$set": {"status": "processing"}})
            log.info("Reading %s page %s with %s", doc["title"], page["n"], settings.vision_model)
            try:
                _process_page(doc, page)
            except Exception as exc:
                log.exception("Vision read failed for %s page %s", doc["_id"], page["n"])
                db().schematics.update_one(
                    {"_id": doc["_id"], "pages.n": page["n"]},
                    {"$set": {"pages.$.status": "error", "pages.$.error": str(exc)[:300]}},
                )
            _refresh_status(doc["_id"])


def wake() -> None:
    _wake.set()


def start_worker() -> None:
    threading.Thread(target=_worker, name="schematic-worker", daemon=True).start()
