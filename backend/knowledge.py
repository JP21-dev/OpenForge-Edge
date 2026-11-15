import re
from functools import lru_cache

import chromadb
import ollama

from config import OPENAI_COMPATIBLE, settings

DEVICE_ALIASES: dict[str, list[str]] = {
    "ps5": ["ps5", "playstation 5", "playstation5", "cfi-1", "cfi-2", "edm-0"],
}


def detect_device(*texts: str | None) -> str | None:
    haystack = " ".join(t for t in texts if t).lower()
    for device, aliases in DEVICE_ALIASES.items():
        if any(alias in haystack for alias in aliases):
            return device
    return None


class EmbeddingMismatch(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _ollama() -> ollama.Client:
    return ollama.Client(host=settings.embed_base_url)


@lru_cache(maxsize=1)
def _openai():
    from openai import OpenAI

    return OpenAI(base_url=settings.embed_base_url, api_key=settings.embed_api_key)


def _embed(texts: list[str]) -> list[list[float]]:
    if settings.embed_provider in OPENAI_COMPATIBLE:
        result = _openai().embeddings.create(model=settings.embed_model, input=texts)
        return [item.embedding for item in sorted(result.data, key=lambda d: d.index)]
    return _ollama().embed(model=settings.embed_model, input=texts)["embeddings"]


def _prefix(kind: str, text: str) -> str:
    return f"{kind}: {text}" if "nomic" in settings.embed_model.lower() else text


def embed_documents(texts: list[str]) -> list[list[float]]:
    return _embed([_prefix("search_document", t) for t in texts])


def embed_query(text: str) -> list[float]:
    return _embed([_prefix("search_query", text)])[0]


@lru_cache(maxsize=1)
def _client():
    if settings.chroma_host:
        return chromadb.HttpClient(host=settings.chroma_host, port=settings.chroma_port)
    return chromadb.PersistentClient(path=settings.chroma_path)


def embedding_id() -> str:
    return f"{settings.embed_provider}:{settings.embed_model}"


def collection():
    return _client().get_or_create_collection(
        settings.chroma_collection,
        configuration={"hnsw": {"space": "cosine"}},
        metadata={"embedding": embedding_id()},
    )


def check_embedding(col) -> None:
    built_with = (col.metadata or {}).get("embedding")
    if col.count() and built_with and built_with != embedding_id():
        raise EmbeddingMismatch(
            f"Knowledge base was built with {built_with} but the backend is set to {embedding_id()}. "
            "Re-run: python ingest.py --reset"
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
    check_embedding(col)
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
