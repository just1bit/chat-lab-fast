# HuggingFace local-model inference (Phase 2 — advanced, optional).
#
# Kept as a light stub so the baseline app runs without `transformers` / `torch`
# installed. Enable with ENABLE_LOCAL_MODELS=true in .env AND
# `pip install transformers torch`. The tutorial walks through wiring this up.

from typing import Optional

from app.config import settings

_local_pipeline: Optional[object] = None


def is_enabled() -> bool:
    return bool(settings.enable_local_models)


def try_load() -> None:
    """Attempt to load the local pipeline on startup.

    Fails silently if the feature flag is off or the optional deps are missing —
    the app falls back to cloud providers and the UI marks local as unavailable.
    """
    global _local_pipeline
    if not is_enabled() or _local_pipeline is not None:
        return
    try:
        from transformers import pipeline  # type: ignore

        _local_pipeline = pipeline("sentiment-analysis")
    except Exception:
        _local_pipeline = None


def analyze(text: str) -> Optional[dict]:
    if _local_pipeline is None:
        return None
    result = _local_pipeline(text)  # type: ignore[misc]
    if isinstance(result, list) and result:
        return result[0]
    return None
