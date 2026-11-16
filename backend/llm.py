from functools import lru_cache

from langchain_core.language_models import BaseChatModel

from config import OPENAI_COMPATIBLE, settings


def model_name(deep: bool = False) -> str:
    return settings.deep_model if deep else settings.llm_model


@lru_cache(maxsize=8)
def get_llm(json_mode: bool = False, deep: bool = False) -> BaseChatModel:
    model = model_name(deep)
    think = settings.deep_thinking and not json_mode if deep else settings.llm_enable_thinking

    if settings.llm_provider in OPENAI_COMPATIBLE:
        from langchain_openai import ChatOpenAI

        model_kwargs = {}
        if json_mode and settings.llm_json_mode:
            model_kwargs["response_format"] = {"type": "json_object"}

        extra_body = {}
        if settings.llm_provider == "lemonade":
            extra_body["enable_thinking"] = think

        return ChatOpenAI(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key,
            model=model,
            temperature=settings.llm_temperature,
            model_kwargs=model_kwargs,
            extra_body=extra_body or None,
        )

    from langchain_ollama import ChatOllama

    return ChatOllama(
        base_url=settings.llm_base_url,
        model=model,
        temperature=settings.llm_temperature,
        keep_alive=settings.llm_keep_alive,
        num_ctx=settings.deep_num_ctx if deep else settings.llm_num_ctx,
        format="json" if json_mode and settings.llm_json_mode else None,
        reasoning=think if _can_think(model) else None,
    )


def _can_think(model: str) -> bool:
    return model.lower().startswith(("qwen3:", "qwen3-", "deepseek-r1"))
