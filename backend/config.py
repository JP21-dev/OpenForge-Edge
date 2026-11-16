import os
from dataclasses import dataclass, field


OPENAI_COMPATIBLE = ("lemonade", "openai")


def _csv(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


def _flag(value: str) -> bool:
    return value.strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Settings:
    llm_provider: str = os.getenv("LLM_PROVIDER", "ollama")
    llm_base_url: str = os.getenv("LLM_BASE_URL", "http://localhost:11434")
    llm_model: str = os.getenv("LLM_MODEL", "qwen2.5:7b")
    llm_temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.2"))
    llm_keep_alive: str = os.getenv("LLM_KEEP_ALIVE", "30m")
    llm_num_ctx: int = int(os.getenv("LLM_NUM_CTX", "8192"))
    llm_api_key: str = os.getenv("LLM_API_KEY", "lemonade")
    llm_json_mode: bool = _flag(os.getenv("LLM_JSON_MODE", "true"))
    llm_enable_thinking: bool = _flag(os.getenv("LLM_ENABLE_THINKING", "false"))
    deep_model: str = os.getenv("DEEP_MODEL", "qwen3:8b")
    deep_thinking: bool = _flag(os.getenv("DEEP_THINKING", "false"))
    deep_num_ctx: int = int(os.getenv("DEEP_NUM_CTX", "12288"))

    embed_provider: str = os.getenv("EMBED_PROVIDER", "ollama")
    embed_base_url: str = os.getenv("EMBED_BASE_URL", "http://localhost:11434")
    embed_model: str = os.getenv("EMBED_MODEL", "nomic-embed-text")
    embed_api_key: str = os.getenv("EMBED_API_KEY", "lemonade")

    vision_provider: str = os.getenv("VISION_PROVIDER", "ollama")
    vision_base_url: str = os.getenv("VISION_BASE_URL", "http://localhost:11434")
    vision_model: str = os.getenv("VISION_MODEL", "qwen3-vl:4b-instruct")
    vision_api_key: str = os.getenv("VISION_API_KEY", "lemonade")
    vision_num_ctx: int = int(os.getenv("VISION_NUM_CTX", "8192"))
    vision_max_side: int = int(os.getenv("VISION_MAX_SIDE", "1600"))
    vision_max_tokens: int = int(os.getenv("VISION_MAX_TOKENS", "1800"))
    vision_timeout: float = float(os.getenv("VISION_TIMEOUT", "600"))

    manuals_dir: str = os.getenv("MANUALS_DIR", "../data/manuals")
    uploads_dir: str = os.getenv("UPLOADS_DIR", "./uploads")
    upload_max_mb: int = int(os.getenv("UPLOAD_MAX_MB", "100"))
    history_collection: str = os.getenv("HISTORY_COLLECTION", "repair_history")
    pattern_min_repairs: int = int(os.getenv("PATTERN_MIN_REPAIRS", "3"))
    pattern_similarity: float = float(os.getenv("PATTERN_SIMILARITY", "0.78"))
    coverage_min_references: int = int(os.getenv("COVERAGE_MIN_REFERENCES", "10"))
    coverage_min_repairs: int = int(os.getenv("COVERAGE_MIN_REPAIRS", "5"))
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
