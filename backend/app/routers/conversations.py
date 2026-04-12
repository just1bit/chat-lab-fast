from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import models as orm
from app.db.database import get_db
from app.schemas.chat import ConversationDetail, ConversationSummary

router = APIRouter()


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(db: Session = Depends(get_db)):
    stmt = select(orm.Conversation).order_by(orm.Conversation.updated_at.desc())
    return list(db.scalars(stmt).all())


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conv = db.get(orm.Conversation, conversation_id)
    if conv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
        )
    return conv


@router.delete(
    "/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_conversation(conversation_id: str, db: Session = Depends(get_db)) -> None:
    conv = db.get(orm.Conversation, conversation_id)
    if conv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
        )
    db.delete(conv)
    db.commit()
