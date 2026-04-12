import json
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db import database as db_module
from app.db import models as orm
from app.db.database import get_db
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.llm_service import ChatMessage, generate_response, stream_response

router = APIRouter()


def _load_or_create_conversation(
    db: Session, conversation_id: Optional[str], first_message: str
) -> orm.Conversation:
    if conversation_id:
        conv = db.get(orm.Conversation, conversation_id)
        if conv is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        return conv
    title = (first_message.strip().splitlines()[0] or "New chat")[:64]
    conv = orm.Conversation(title=title)
    db.add(conv)
    db.flush()
    return conv


def _build_history(
    prior: list[tuple[str, str]], new_user_content: str
) -> list[ChatMessage]:
    history = [ChatMessage(role=r, content=c) for r, c in prior]
    history.append(ChatMessage(role="user", content=new_user_content))
    return history


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest, db: Session = Depends(get_db)
) -> ChatResponse:
    conv = _load_or_create_conversation(db, request.conversation_id, request.message)
    prior = [(m.role, m.content) for m in conv.messages]
    history = _build_history(prior, request.message)

    start = time.perf_counter()
    reply = await generate_response(request.provider, request.model, history)
    elapsed_ms = (time.perf_counter() - start) * 1000

    db.add(
        orm.Message(
            conversation_id=conv.id,
            role="user",
            content=request.message,
            provider=request.provider,
            model=request.model,
        )
    )
    db.add(
        orm.Message(
            conversation_id=conv.id,
            role="assistant",
            content=reply,
            provider=request.provider,
            model=request.model,
        )
    )
    db.commit()

    return ChatResponse(
        response=reply,
        provider=request.provider,
        model=request.model,
        conversation_id=conv.id,
        response_time_ms=round(elapsed_ms, 2),
    )


@router.get("/chat/stream")
async def chat_stream(
    message: str = Query(..., min_length=1, max_length=10_000),
    provider: str = Query("openrouter"),
    model: str = Query("openrouter/free"),
    conversation_id: Optional[str] = Query(None),
) -> StreamingResponse:
    # Short-lived setup session: create/fetch conversation, persist user turn,
    # materialize prior history before the session closes.
    with db_module.SessionLocal() as db:
        conv = _load_or_create_conversation(db, conversation_id, message)
        conv_id = conv.id
        prior = [(m.role, m.content) for m in conv.messages]
        db.add(
            orm.Message(
                conversation_id=conv_id,
                role="user",
                content=message,
                provider=provider,
                model=model,
            )
        )
        db.commit()

    history = _build_history(prior, message)

    async def event_source():
        yield f"event: meta\ndata: {json.dumps({'conversation_id': conv_id})}\n\n"
        collected: list[str] = []
        try:
            async for chunk in stream_response(provider, model, history):
                collected.append(chunk)
                # SSE data lines can't contain literal newlines; escape them.
                payload = chunk.replace("\r", "").replace("\n", "\\n")
                yield f"data: {payload}\n\n"
        except Exception as exc:
            yield f"event: error\ndata: {json.dumps({'detail': str(exc)})}\n\n"

        # Persist assistant turn after streaming completes.
        full = "".join(collected)
        if full:
            with db_module.SessionLocal() as db:
                db.add(
                    orm.Message(
                        conversation_id=conv_id,
                        role="assistant",
                        content=full,
                        provider=provider,
                        model=model,
                    )
                )
                db.commit()

        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(event_source(), media_type="text/event-stream")
