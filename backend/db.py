from datetime import datetime, timezone
from functools import lru_cache

from pymongo import MongoClient
from pymongo.database import Database

from config import settings


@lru_cache(maxsize=1)
def _client() -> MongoClient:
    return MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=3000)


def db() -> Database:
    return _client()[settings.mongo_db]


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def public(doc: dict | None) -> dict | None:
    if doc is None:
        return None
    out = {k: v for k, v in doc.items() if k != "_id"}
    out["id"] = str(doc["_id"])
    return out
