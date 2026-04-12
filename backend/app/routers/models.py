from fastapi import APIRouter

from app.providers import ACTIVE_MODEL, ACTIVE_PROVIDER, PROVIDERS
from app.schemas.chat import ModelsResponse, ProviderInfo
from app.services.llm_service import provider_available

router = APIRouter()


@router.get("/models", response_model=ModelsResponse)
async def list_models() -> ModelsResponse:
    providers = [
        ProviderInfo(
            name=cfg.name,
            display_name=cfg.display_name,
            is_local=cfg.is_local,
            available=provider_available(cfg),
            models=cfg.models,
        )
        for cfg in PROVIDERS.values()
    ]
    return ModelsResponse(
        active_provider=ACTIVE_PROVIDER,
        active_model=ACTIVE_MODEL,
        providers=providers,
    )
