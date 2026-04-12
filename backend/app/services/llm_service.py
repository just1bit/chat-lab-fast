from dataclasses import dataclass
from typing import AsyncIterator, Iterable

from fastapi import HTTPException, status

from app.providers import PROVIDERS, ProviderConfig


@dataclass
class ChatMessage:
    role: str
    content: str


def provider_available(cfg: ProviderConfig) -> bool:
    if cfg.is_local:
        return True
    return bool(cfg.api_key)


def resolve_provider(name: str) -> ProviderConfig:
    cfg = PROVIDERS.get(name)
    if cfg is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown provider: {name}",
        )
    return cfg


def _build_llm(cfg: ProviderConfig, model: str):
    from langchain_openai import ChatOpenAI

    if not cfg.api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Missing API key for provider '{cfg.name}'. Set it in backend/providers.json.",
        )
    return ChatOpenAI(
        model=model,
        api_key=cfg.api_key,
        base_url=cfg.base_url,
        streaming=True,
    )


def _to_lc_messages(messages: Iterable[ChatMessage]):
    from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

    mapping = {"system": SystemMessage, "user": HumanMessage, "assistant": AIMessage}
    return [mapping.get(m.role, HumanMessage)(content=m.content) for m in messages]


async def generate_response(
    provider: str, model: str, messages: list[ChatMessage]
) -> str:
    cfg = resolve_provider(provider)
    try:
        llm = _build_llm(cfg, model)
        lc_messages = _to_lc_messages(messages)
        ai_message = await llm.ainvoke(lc_messages)
        return ai_message.content if hasattr(ai_message, "content") else str(ai_message)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Provider '{cfg.name}' error: {exc}",
        ) from exc


async def stream_response(
    provider: str, model: str, messages: list[ChatMessage]
) -> AsyncIterator[str]:
    cfg = resolve_provider(provider)
    llm = _build_llm(cfg, model)
    lc_messages = _to_lc_messages(messages)
    async for chunk in llm.astream(lc_messages):
        text = getattr(chunk, "content", None)
        if text:
            yield text
