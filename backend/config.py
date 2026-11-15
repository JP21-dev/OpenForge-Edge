import os
from dataclasses import dataclass, field


def _csv(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    llm_provider: str = os.getenv("LLM_PROVIDER", "ollama")
    llm_base_url: str = os.getenv("LLM_BASE_URL", "http://localhost:11434")
    llm_model: str = os.getenv("LLM_MODEL", "qwen2.5:7b")
    llm_temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.2"))
    llm_keep_alive: str = os.getenv("LLM_KEEP_ALIVE", "30m")
    llm_num_ctx: int = int(os.getenv("LLM_NUM_CTX", "8192"))

    embed_base_url: str = os.getenv("EMBED_BASE_URL", "http://localhost:11434")
    embed_model: str = os.getenv("EMBED_MODEL", "nomic-embed-text")

    manuals_dir: str = os.getenv("MANUALS_DIR", "../data/manuals")
    rag_top_k: int = int(os.getenv("RAG_TOP_K", "4"))
    rag_min_score: float = float(os.getenv("RAG_MIN_SCORE", "0.6"))

    chroma_host: str | None = os.getenv("CHROMA_HOST") or None
    chroma_port: int = int(os.getenv("CHROMA_PORT", "8000"))
    chroma_path: str = os.getenv("CHROMA_PATH", "./chroma_data")
    chroma_collection: str = os.getenv("CHROMA_COLLECTION", "repair_manuals")

    mongo_uri: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    mongo_db: str = os.getenv("MONGO_DB", "openforge")

    cors_origins: list[str] = field(
        default_factory=lambda: _csv(
            os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
        )
    )


settings = Settings()
