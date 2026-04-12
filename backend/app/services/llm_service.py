import json
from dataclasses import dataclass
from typing import AsyncIterator, Iterable

import httpx
from fastapi import HTTPException, status

from app.providers import PROVIDERS, ProviderConfig


@dataclass
class ChatMessage:
    role: str
    content: str


@dataclass
class StreamChunk:
    """A single piece of streamed output."""
    text: str
    is_thinking: bool = False


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


async def _stream_raw_sse(
    cfg: ProviderConfig, model: str, messages: list[ChatMessage]
) -> AsyncIterator[StreamChunk]:
    """Stream via raw httpx SSE to preserve reasoning_content from DeepSeek etc."""
    url = cfg.base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {cfg.api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": model,
        "messages": [{"role": m.role, "content": m.content} for m in messages],
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
        async with client.stream("POST", url, headers=headers, json=body) as resp:
            if resp.status_code != 200:
                detail = ""
                async for part in resp.aiter_text():
                    detail += part
                raise HTTPException(
                    status_code=502,
                    detail=f"Provider '{cfg.name}' error ({resp.status_code}): {detail[:500]}",
                )
            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    parsed = json.loads(data)
                except json.JSONDecodeError:
                    continue
                choices = parsed.get("choices", [])
                if not choices:
                    continue
                delta = choices[0].get("delta", {})

                # Check for reasoning/thinking content
                reasoning = delta.get("reasoning_content")
                if reasoning:
                    yield StreamChunk(text=reasoning, is_thinking=True)
                    continue

                content = delta.get("content")
                if content:
                    yield StreamChunk(text=content, is_thinking=False)


async def _stream_langchain(
    cfg: ProviderConfig, model: str, messages: list[ChatMessage]
) -> AsyncIterator[StreamChunk]:
    """Stream via LangChain (for providers without reasoning_content)."""
    llm = _build_llm(cfg, model)
    lc_messages = _to_lc_messages(messages)
    async for chunk in llm.astream(lc_messages):
        text = getattr(chunk, "content", None)
        if text:
            yield StreamChunk(text=text, is_thinking=False)


async def stream_response(
    provider: str, model: str, messages: list[ChatMessage]
) -> AsyncIterator[StreamChunk]:
    cfg = resolve_provider(provider)
    if not cfg.api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Missing API key for provider '{cfg.name}'. Set it in backend/providers.json.",
        )
    # Use raw SSE for all providers — it preserves reasoning_content and
    # works with any OpenAI-compatible API.
    async for chunk in _stream_raw_sse(cfg, model, messages):
        yield chunk
