"""Tests for the local HuggingFace model integration (Phase 2).

These tests mock the model and tokenizer so they run without
actually downloading model weights — fast and CI-friendly.
"""

import sys
from unittest.mock import MagicMock, patch

from app.services import local_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_fake_tokenizer(with_chat_template=False):
    """Create a fake tokenizer.

    with_chat_template=False  → base/dialogue model (no chat template)
    with_chat_template=True   → instruction-tuned model (SmolLM2-style)
    """
    tok = MagicMock()
    tok.eos_token = "<|endoftext|>"
    tok.eos_token_id = 50256
    tok.pad_token_id = 50256
    fake_input = MagicMock()
    fake_input.shape = [1, 5]
    fake_input.__getitem__ = lambda self, key: self
    tok.encode.return_value = fake_input
    tok.decode.return_value = "Hello! How are you?"

    if with_chat_template:
        tok.chat_template = "{% for m in messages %}{{ m.content }}{% endfor %}"
        fake_chat_output = {
            "input_ids": MagicMock(shape=[1, 8]),
            "attention_mask": MagicMock(shape=[1, 8]),
        }
        fake_chat_output["input_ids"].__getitem__ = lambda self, key: self
        tok.apply_chat_template.return_value = fake_chat_output
    else:
        tok.chat_template = None

    return tok


def _make_fake_model():
    model = MagicMock()
    fake_output = MagicMock()
    fake_output.__getitem__ = lambda self, key: self
    fake_output.shape = [1, 10]
    model.generate.return_value = fake_output
    return model


def _inject_model(model_id="HuggingFaceTB/SmolLM2-135M-Instruct", with_chat_template=True):
    """Insert a fake model+tokenizer into the loaded cache."""
    local_service._models[model_id] = _make_fake_model()
    local_service._tokenizers[model_id] = _make_fake_tokenizer(with_chat_template=with_chat_template)


def _clear_models():
    local_service._models.clear()
    local_service._tokenizers.clear()


# ---------------------------------------------------------------------------
# Unit tests
# ---------------------------------------------------------------------------

def test_local_service_disabled_by_default():
    assert local_service.is_enabled() == local_service.settings.enable_local_models


def test_not_loaded_when_empty():
    with patch.object(local_service, "_models", {}), \
         patch.object(local_service, "_tokenizers", {}):
        assert local_service.is_loaded() is False
        assert local_service.is_loaded("HuggingFaceTB/SmolLM2-135M-Instruct") is False


@patch.object(local_service, "_deps_available", False)
def test_generate_response_when_deps_missing():
    resp = local_service.generate_response("HuggingFaceTB/SmolLM2-135M-Instruct", "hello")
    assert "not available" in resp.lower()


def test_is_loaded_checks_specific_model():
    _clear_models()
    _inject_model("HuggingFaceTB/SmolLM2-135M-Instruct")
    try:
        assert local_service.is_loaded() is True
        assert local_service.is_loaded("HuggingFaceTB/SmolLM2-135M-Instruct") is True
        assert local_service.is_loaded("some/other-model") is False
    finally:
        _clear_models()


def test_generate_response_with_mocked_model():
    """Inject fake model into cache and verify generate_response works."""
    fake_torch = MagicMock()
    fake_torch.no_grad.return_value.__enter__ = MagicMock()
    fake_torch.no_grad.return_value.__exit__ = MagicMock()

    _clear_models()
    _inject_model("HuggingFaceTB/SmolLM2-135M-Instruct")
    try:
        with patch.object(local_service, "_deps_available", True), \
             patch.object(local_service, "is_enabled", return_value=True), \
             patch.dict(sys.modules, {"torch": fake_torch}):
            resp = local_service.generate_response(
                "HuggingFaceTB/SmolLM2-135M-Instruct", "Hi there"
            )
        assert resp == "Hello! How are you?"
    finally:
        _clear_models()


# ---------------------------------------------------------------------------
# _tokenize: base model vs instruction-tuned model
# ---------------------------------------------------------------------------

def test_tokenize_base_model_uses_encode():
    """Base model (no chat_template) → encode(text + eos_token)."""
    fake_torch = MagicMock()
    fake_torch.ones_like.return_value = MagicMock()

    tok = _make_fake_tokenizer(with_chat_template=False)
    with patch.dict(sys.modules, {"torch": fake_torch}):
        result = local_service._tokenize(tok, "Hello")

    # Should call encode, NOT apply_chat_template
    tok.encode.assert_called_once_with("Hello" + tok.eos_token, return_tensors="pt")
    tok.apply_chat_template.assert_not_called()
    assert "input_ids" in result
    assert "attention_mask" in result


def test_tokenize_instruct_model_uses_chat_template():
    """Instruction-tuned model (has chat_template) → apply_chat_template()."""
    tok = _make_fake_tokenizer(with_chat_template=True)
    with patch.dict(sys.modules, {"torch": MagicMock()}):
        result = local_service._tokenize(tok, "Hello")

    # Should call apply_chat_template, NOT encode
    tok.apply_chat_template.assert_called_once_with(
        [{"role": "user", "content": "Hello"}],
        return_tensors="pt",
        add_generation_prompt=True,
        return_dict=True,
    )
    tok.encode.assert_not_called()
    assert "input_ids" in result
    assert "attention_mask" in result


def test_generate_response_instruct_model():
    """Full generate path with an instruction-tuned tokenizer."""
    fake_torch = MagicMock()
    fake_torch.no_grad.return_value.__enter__ = MagicMock()
    fake_torch.no_grad.return_value.__exit__ = MagicMock()

    tok = _make_fake_tokenizer(with_chat_template=True)
    model = _make_fake_model()

    _clear_models()
    mid = "HuggingFaceTB/SmolLM2-135M-Instruct"
    local_service._models[mid] = model
    local_service._tokenizers[mid] = tok
    try:
        with patch.object(local_service, "_deps_available", True), \
             patch.object(local_service, "is_enabled", return_value=True), \
             patch.dict(sys.modules, {"torch": fake_torch}):
            resp = local_service.generate_response(mid, "What is Python?")

        assert resp == "Hello! How are you?"
        tok.apply_chat_template.assert_called_once()
        tok.encode.assert_not_called()
        model.generate.assert_called_once()
    finally:
        _clear_models()


def test_generate_response_model_not_loaded():
    _clear_models()
    with patch.object(local_service, "_deps_available", True), \
         patch.object(local_service, "is_enabled", return_value=True):
        resp = local_service.generate_response("unknown/model", "Hi")
    assert "not loaded" in resp.lower()


def test_get_status():
    status = local_service.get_status()
    assert "enabled" in status
    assert "loaded_models" in status


# ---------------------------------------------------------------------------
# Integration: /api/models
# ---------------------------------------------------------------------------

def test_models_endpoint_includes_local_provider(client):
    response = client.get("/api/models")
    assert response.status_code == 200
    data = response.json()
    providers = {p["name"]: p for p in data["providers"]}

    assert "local" in providers
    lp = providers["local"]
    assert lp["is_local"] is True
    assert "HuggingFaceTB/SmolLM2-135M-Instruct" in lp["models"]


# ---------------------------------------------------------------------------
# Integration: chat with local provider
# ---------------------------------------------------------------------------

@patch.object(local_service, "_deps_available", True)
@patch.object(local_service, "is_enabled", return_value=True)
@patch.object(local_service, "generate_response", return_value="I'm doing well!")
def test_chat_with_local_provider(mock_gen, mock_enabled, client):
    response = client.post(
        "/api/chat",
        json={
            "message": "How are you?",
            "provider": "local",
            "model": "HuggingFaceTB/SmolLM2-135M-Instruct",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "local"
    assert body["response"] == "I'm doing well!"
    mock_gen.assert_called_once_with("HuggingFaceTB/SmolLM2-135M-Instruct", "How are you?")


@patch.object(local_service, "_deps_available", True)
@patch.object(local_service, "is_enabled", return_value=True)
@patch.object(local_service, "generate_response", return_value="Nice to meet you!")
def test_stream_with_local_provider(mock_gen, mock_enabled, client):
    with client.stream(
        "GET",
        "/api/chat/stream",
        params={
            "message": "Hello!",
            "provider": "local",
            "model": "HuggingFaceTB/SmolLM2-135M-Instruct",
        },
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    assert "event: meta" in body
    assert "event: done" in body
    assert "Nice to meet you!" in body
