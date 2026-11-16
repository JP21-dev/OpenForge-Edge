import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from PIL import Image, ImageOps
from pydantic import BaseModel, Field

from config import settings
from db import db, now, public
from knowledge import device_slug
from schematics import _spool

router = APIRouter(prefix="/api/step-photos", tags=["step-photos"])

MAX_SIDE = 2000


def _dir() -> Path:
    path = Path(settings.uploads_dir) / "step-photos"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _path(photo_id: str) -> Path:
    return _dir() / f"{photo_id}.jpg"


def _store(src: Path, dest: Path) -> tuple[int, int]:
    with Image.open(src) as img:
        img = ImageOps.exif_transpose(img).convert("RGB")
        scale = MAX_SIDE / max(img.size)
        if scale < 1:
            img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
        img.save(dest, format="JPEG", quality=85, optimize=True)
        return img.size


@router.post("")
async def upload_photo(
    file: UploadFile = File(...),
    device_model: str = Form(..., min_length=1, max_length=80),
    step_id: str = Form(..., min_length=1, max_length=80),
) -> dict:
    device = device_slug(device_model)
    photo_id = uuid.uuid4().hex
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "upload"
        await _spool(file, raw)
        try:
            width, height = await run_in_threadpool(_store, raw, _path(photo_id))
        except Exception as exc:
            raise HTTPException(400, f"Could not read the image: {exc}") from exc

    old = db().step_photos.find_one({"device": device, "step_id": step_id})
    db().step_photos.delete_many({"device": device, "step_id": step_id})
    if old:
        _path(old["_id"]).unlink(missing_ok=True)
    doc = {
        "_id": photo_id,
        "device": device,
        "device_model": device_model.strip(),
        "step_id": step_id,
        "width": width,
        "height": height,
        "markers": {},
        "created_at": now(),
    }
    db().step_photos.insert_one(doc)
    return public(doc)


@router.get("")
def list_photos(device_model: str) -> list[dict]:
    return [public(d) for d in db().step_photos.find({"device": device_slug(device_model)})]


@router.get("/{photo_id}/image")
def photo_image(photo_id: str) -> FileResponse:
    if not db().step_photos.find_one({"_id": photo_id}, {"_id": 1}):
        raise HTTPException(404, "Photo not found")
    return FileResponse(_path(photo_id), media_type="image/jpeg", headers={"Cache-Control": "private, max-age=86400"})


class Markers(BaseModel):
    markers: dict[str, tuple[float, float]] = Field(max_length=500)


@router.put("/{photo_id}/markers")
def save_markers(photo_id: str, body: Markers) -> dict:
    clean = {k[:80]: (min(max(x, 0.0), 100.0), min(max(y, 0.0), 100.0)) for k, (x, y) in body.markers.items()}
    if not db().step_photos.update_one({"_id": photo_id}, {"$set": {"markers": clean, "updated_at": now()}}).matched_count:
        raise HTTPException(404, "Photo not found")
    return public(db().step_photos.find_one({"_id": photo_id}))


@router.delete("/{photo_id}")
def delete_photo(photo_id: str) -> dict:
    if not db().step_photos.delete_one({"_id": photo_id}).deleted_count:
        raise HTTPException(404, "Photo not found")
    _path(photo_id).unlink(missing_ok=True)
    return {"deleted": photo_id}
