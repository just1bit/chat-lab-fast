from unittest.mock import AsyncMock, patch


@patch(
    "app.routers.chat.generate_response",
    new_callable=AsyncMock,
    return_value="Hello from the test stub!",
)
def test_chat_creates_conversation(mock_gen, client):
    response = client.post(
        "/api/chat",
        json={"message": "Hello there", "provider": "openrouter", "model": "openrouter/free"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "openrouter"
    assert body["response"] == "Hello from the test stub!"
    assert body["conversation_id"]
    assert body["response_time_ms"] >= 0


@patch(
    "app.routers.chat.generate_response",
    new_callable=AsyncMock,
    return_value="Reply",
)
def test_chat_continues_existing_conversation(mock_gen, client):
    first = client.post(
        "/api/chat",
        json={"message": "Hi", "provider": "openrouter", "model": "openrouter/free"},
    ).json()
    cid = first["conversation_id"]

    second = client.post(
        "/api/chat",
        json={
            "message": "Follow-up question",
            "provider": "openrouter",
            "model": "openrouter/free",
            "conversation_id": cid,
        },
    )
    assert second.status_code == 200
    assert second.json()["conversation_id"] == cid

    detail = client.get(f"/api/conversations/{cid}").json()
    roles = [m["role"] for m in detail["messages"]]
    assert roles == ["user", "assistant", "user", "assistant"]


def test_chat_rejects_empty_message(client):
    response = client.post(
        "/api/chat",
        json={"message": "", "provider": "openrouter", "model": "openrouter/free"},
    )
    assert response.status_code == 422


@patch("app.routers.chat.stream_response")
def test_chat_stream_emits_meta_data_and_done_events(mock_stream, client):
    async def fake_stream(*args, **kwargs):
        for word in ["Hello ", "world!"]:
            yield word

    mock_stream.return_value = fake_stream()

    with client.stream(
        "GET",
        "/api/chat/stream",
        params={
            "message": "stream me",
            "provider": "openrouter",
            "model": "openrouter/free",
        },
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    assert "event: meta" in body
    assert '"conversation_id"' in body
    assert "event: done" in body

    reassembled = "".join(
        line.removeprefix("data: ")
        for line in body.splitlines()
        if line.startswith("data: ")
        and not line.startswith("data: [DONE]")
        and not line.startswith("data: {")
    )
    assert "Hello " in reassembled
    assert "world!" in reassembled
