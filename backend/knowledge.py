import re
from functools import lru_cache

import chromadb
import ollama

from config import settings

DEVICE_ALIASES: dict[str, list[str]] = {
    "ps5": ["ps5", "playstation 5", "playstation5", "cfi-1", "cfi-2", "edm-0"],
}


def detect_device(*texts: str | None) -> str | None:
    haystack = " ".join(t for t in texts if t).lower()
    for device, aliases in DEVICE_ALIASES.items():
        if any(alias in haystack for alias in aliases):
            return device
    return None


@lru_cache(maxsize=1)
def _ollama() -> ollama.Client:
    return ollama.Client(host=settings.embed_base_url)


def embed_documents(texts: list[str]) -> list[list[float]]:
    result = _ollama().embed(model=settings.embed_model, input=[f"search_document: {t}" for t in texts])
    return result["embeddings"]


def embed_query(text: str) -> list[float]:
    result = _ollama().embed(model=settings.embed_model, input=[f"search_query: {text}"])
    return result["embeddings"][0]


@lru_cache(maxsize=1)
def _client():
    if settings.chroma_host:
        return chromadb.HttpClient(host=settings.chroma_host, port=settings.chroma_port)
    return chromadb.PersistentClient(path=settings.chroma_path)


def collection():
    return _client().get_or_create_collection(
        settings.chroma_collection,
        configuration={"hnsw": {"space": "cosine"}},
    )


def reset_collection() -> None:
    try:
        _client().delete_collection(settings.chroma_collection)
    except Exception:
        pass


def search(query: str, device: str | None, k: int | None = None) -> list[dict]:
    col = collection()
    if col.count() == 0:
        return []
    res = col.query(
        query_embeddings=[embed_query(query)],
        n_results=k or settings.rag_top_k,
        where={"device": device} if device else None,
    )
    docs = []
    for text, meta, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
        score = round(1 - dist, 3)
        if score < settings.rag_min_score:
            continue
        page = meta.get("page") or None
        title = meta.get("section") or ""
        docs.append(
            {
                "source": meta.get("source", "unknown") + (f" › {title}" if title else ""),
                "page": page,
                "text": re.sub(r"\s+", " ", text).strip(),
                "score": score,
            }
        )
    return docs
