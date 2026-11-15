from functools import lru_cache

from langchain_core.language_models import BaseChatModel

from config import settings


@lru_cache(maxsize=4)
def get_llm(json_mode: bool = False) -> BaseChatModel:
    if settings.llm_provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            base_url=settings.llm_base_url,
            api_key="not-needed",
            model=settings.llm_model,
            temperature=settings.llm_temperature,
            model_kwargs={"response_format": {"type": "json_object"}} if json_mode else {},
        )

    from langchain_ollama import ChatOllama

    return ChatOllama(
        base_url=settings.llm_base_url,
        model=settings.llm_model,
        temperature=settings.llm_temperature,
        keep_alive=settings.llm_keep_alive,
        format="json" if json_mode else None,
    )
