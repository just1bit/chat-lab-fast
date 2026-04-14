# HuggingFace local-model inference (Phase 2 — advanced, optional).
#
# Demonstrates Python's unique ability to load ML model weights directly
# into the FastAPI process and run inference in-process — something
# Node.js/Express simply cannot do.
#
# Enable with ENABLE_LOCAL_MODELS=true in .env AND
#   pip install transformers torch
#
# Available models are configured in providers.json under the local
# provider's "models" list. Each entry is a HuggingFace model ID
# (e.g. "HuggingFaceTB/SmolLM2-135M-Instruct"). ALL listed models are downloaded
# and loaded into memory at startup, so switching between them is instant.

import logging
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

# All loaded models keyed by HuggingFace model ID.
_models: dict[str, object] = {}
_tokenizers: dict[str, object] = {}
_deps_available: Optional[bool] = None  # cached import check


def is_enabled() -> bool:
    """Check whether local models are turned on via the feature flag."""
    return bool(settings.enable_local_models)


def _check_deps() -> bool:
    """Return True if transformers + torch are importable (cached)."""
    global _deps_available
    if _deps_available is None:
        try:
            import transformers  # type: ignore  # noqa: F401
            import torch  # type: ignore  # noqa: F401
            _deps_available = True
        except ImportError:
            _deps_available = False
    return _deps_available


def is_ready() -> bool:
    """Return True if local models can be used (flag on + deps installed)."""
    return is_enabled() and _check_deps()


def is_loaded(model_id: Optional[str] = None) -> bool:
    """Check whether a model (or any model) is loaded in memory."""
    if model_id is not None:
        return model_id in _models
    return len(_models) > 0


def get_status() -> dict:
    """Return a status dict for diagnostics / the models endpoint."""
    return {
        "enabled": is_enabled(),
        "deps_available": _check_deps() if is_enabled() else None,
        "loaded_models": list(_models.keys()),
    }


def load_models_on_startup(model_ids: list[str]) -> None:
    """Download and load all configured local models at startup.

    Called from the FastAPI lifespan handler. Each model is loaded
    into memory and kept there for the lifetime of the process —
    no unloading, no re-downloading. Switching between models in
    the UI is instant.
    """
    if not is_enabled():
        logger.info("Local models disabled (ENABLE_LOCAL_MODELS=false)")
        return

    if not _check_deps():
        logger.warning(
            "Local models enabled but transformers/torch not installed. "
            "Run: pip install transformers torch"
        )
        return

    if not model_ids:
        logger.info("No local models configured in providers.json")
        return

    from transformers import AutoModelForCausalLM, AutoTokenizer  # type: ignore

    for model_id in model_ids:
        if model_id in _models:
            continue
        try:
            logger.info("Loading local model [%d/%d]: %s …",
                        len(_models) + 1, len(model_ids), model_id)
            _tokenizers[model_id] = AutoTokenizer.from_pretrained(model_id)
            _models[model_id] = AutoModelForCausalLM.from_pretrained(model_id)
            logger.info("Loaded successfully: %s", model_id)
        except Exception as exc:
            logger.error("Failed to load %s: %s", model_id, exc)

    logger.info("Local models ready: %d/%d loaded", len(_models), len(model_ids))


def _tokenize(tokenizer, text: str) -> dict:
    """Build model inputs, using chat template for instruction-tuned models."""
    import torch  # type: ignore

    if hasattr(tokenizer, "chat_template") and tokenizer.chat_template:
        # Instruction-tuned model — format as a proper chat conversation
        messages = [{"role": "user", "content": text}]
        return tokenizer.apply_chat_template(
            messages, return_tensors="pt", add_generation_prompt=True, return_dict=True,
        )
    else:
        # Base / dialogue model without chat template — simple encoding
        input_ids = tokenizer.encode(
            text + tokenizer.eos_token, return_tensors="pt"
        )
        # Build attention_mask: 1 for all real tokens (eos_token is also real)
        attention_mask = torch.ones_like(input_ids)
        return {"input_ids": input_ids, "attention_mask": attention_mask}


def generate_response(model_id: str, text: str) -> str:
    """Generate a conversational reply using the specified local model."""
    if not is_ready():
        return (
            "Local model is not available. Make sure ENABLE_LOCAL_MODELS=true "
            "is set in your .env and you have installed `transformers` and `torch`."
        )

    if model_id not in _models or model_id not in _tokenizers:
        return f"Model '{model_id}' is not loaded. Check providers.json and restart the server."

    import torch  # type: ignore

    model = _models[model_id]
    tokenizer = _tokenizers[model_id]

    inputs = _tokenize(tokenizer, text)
    input_len = inputs["input_ids"].shape[-1]

    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=128,
            pad_token_id=tokenizer.pad_token_id or tokenizer.eos_token_id,
            do_sample=True,
            top_k=50,
            top_p=0.95,
            temperature=0.7,
            repetition_penalty=1.2,
        )

    reply_ids = output_ids[:, input_len:]
    reply = tokenizer.decode(reply_ids[0], skip_special_tokens=True).strip()

    return reply if reply else "..."
