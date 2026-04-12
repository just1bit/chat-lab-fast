import json
from pathlib import Path

from pydantic import BaseModel

PROVIDERS_FILE = Path(__file__).resolve().parent.parent / "providers.json"


class ProviderConfig(BaseModel):
    name: str
    display_name: str
    base_url: str
    api_key: str = ""
    models: list[str]
    is_local: bool = False


def _load_providers() -> tuple[str, str, dict[str, ProviderConfig]]:
    data = json.loads(PROVIDERS_FILE.read_text(encoding="utf-8"))
    active_provider = data.get("active_provider", "openrouter")
    active_model = data.get("active_model", "openrouter/free")
    providers: dict[str, ProviderConfig] = {}
    for key, val in data.get("providers", {}).items():
        providers[key] = ProviderConfig(name=key, **val)
    return active_provider, active_model, providers


ACTIVE_PROVIDER, ACTIVE_MODEL, PROVIDERS = _load_providers()
