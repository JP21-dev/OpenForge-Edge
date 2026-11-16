import logging
import threading
from typing import Literal

import httpx

from config import OPENAI_COMPATIBLE, settings
from db import db, now

log = logging.getLogger(__name__)

Mode = Literal["repair", "ingest"]
MODES: tuple[Mode, ...] = ("repair", "ingest")

_lock = threading.Lock()
_mode: Mode | None = None
_loading: str | None = None


def _models(mode: Mode) -> tuple[str, str, str]:
    if mode == "ingest":
        return settings.vision_provider, settings.vision_base_url, settings.vision_model
    return settings.llm_provider, settings.llm_base_url, settings.llm_model


def current() -> Mode:
    global _mode
    if _mode is None:
        try:
            doc = db().app_state.find_one({"_id": "mode"}) or {}
            _mode = doc.get("mode") if doc.get("mode") in MODES else "repair"
        except Exception as exc:
            log.warning("Could not read mode from MongoDB, defaulting to repair: %s", exc)
            return "repair"
    return _mode


def status() -> dict:
    mode = current()
    return {
        "mode": mode,
        "active_model": _models(mode)[2],
        "chat_model": settings.llm_model,
        "deep_model": settings.deep_model,
        "vision_model": settings.vision_model,
        "loading": _loading,
    }


def _call(provider: str, base_url: str, model: str, load: bool) -> None:
    timeout = 300 if load else 30
    if provider in OPENAI_COMPATIBLE:
        if provider != "lemonade":
            return
        root = base_url.rstrip("/")
        path = "load" if load else "unload"
        body = {"model_name": model} if load else {}
        httpx.post(f"{root}/{path}", json=body, timeout=timeout).raise_for_status()
        return
    body: dict = {"model": model, "keep_alive": settings.llm_keep_alive if load else 0}
    if load:
        num_ctx = settings.vision_num_ctx if model == settings.vision_model else settings.llm_num_ctx
        body["options"] = {"num_ctx": num_ctx}
    httpx.post(f"{base_url.rstrip('/')}/api/generate", json=body, timeout=timeout).raise_for_status()


def _preload(provider: str, base_url: str, model: str) -> None:
    global _loading
    try:
        _call(provider, base_url, model, load=True)
    except Exception as exc:
        log.warning("Preloading %s failed (it will load on first use): %s", model, exc)
    finally:
        _loading = None


def switch(target: Mode) -> dict:
    global _mode, _loading
    with _lock:
        previous = current()
        if target != previous:
            old = _models(previous)
            if old[2] != _models(target)[2]:
                try:
                    _call(*old, load=False)
                except Exception as exc:
                    log.warning("Unloading %s failed: %s", old[2], exc)
            db().app_state.update_one(
                {"_id": "mode"}, {"$set": {"mode": target, "changed_at": now()}}, upsert=True
            )
            _mode = target
        new = _models(target)
        _loading = new[2]
        threading.Thread(target=_preload, args=new, daemon=True).start()
    return status()
