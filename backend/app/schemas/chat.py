from typing import Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    provider: str = "openrouter"
    model: str = "meta-llama/llama-3-8b-instruct:free"
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    provider: str
    model: str
    conversation_id: str
    response_time_ms: float


class ProviderConfig(BaseModel):
    name: str
    base_url: str
    api_key_env: str
    models: list[str]
    is_local: bool = False


class ModelInfo(BaseModel):
    provider: str
    model_id: str
    display_name: str
    is_local: bool
    description: str
