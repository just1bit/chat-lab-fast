from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10_000)
    provider: str = "openrouter"
    model: str = "openrouter/free"
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    provider: str
    model: str
    conversation_id: str
    response_time_ms: float


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: str
    content: str
    provider: str
    model: str
    created_at: datetime


class ConversationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    provider: str
    model: str
    created_at: datetime
    updated_at: datetime


class ConversationDetail(ConversationSummary):
    messages: list[MessageOut]


class ProviderInfo(BaseModel):
    name: str
    display_name: str
    is_local: bool
    available: bool
    models: list[str]


class ModelsResponse(BaseModel):
    active_provider: str
    active_model: str
    providers: list[ProviderInfo]
