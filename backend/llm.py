from functools import lru_cache

from langchain_core.language_models import BaseChatModel

from config import OPENAI_COMPATIBLE, settings


@lru_cache(maxsize=4)
def get_llm(json_mode: bool = False) -> BaseChatModel:
    if settings.llm_provider in OPENAI_COMPATIBLE:
        from langchain_openai import ChatOpenAI

        model_kwargs = {}
        if json_mode and settings.llm_json_mode:
            model_kwargs["response_format"] = {"type": "json_object"}

        extra_body = {}
        if settings.llm_provider == "lemonade":
            extra_body["enable_thinking"] = settings.llm_enable_thinking

        return ChatOpenAI(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key,
            model=settings.llm_model,
            temperature=settings.llm_temperature,
            model_kwargs=model_kwargs,
            extra_body=extra_body or None,
        )

    from langchain_ollama import ChatOllama

    return ChatOllama(
        base_url=settings.llm_base_url,
        model=settings.llm_model,
        temperature=settings.llm_temperature,
        keep_alive=settings.llm_keep_alive,
        num_ctx=settings.llm_num_ctx,
        format="json" if json_mode and settings.llm_json_mode else None,
    )
