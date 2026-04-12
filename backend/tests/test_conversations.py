from unittest.mock import AsyncMock, patch


@patch(
    "app.routers.chat.generate_response",
    new_callable=AsyncMock,
    return_value="Test reply",
)
def test_conversation_lifecycle(mock_gen, client):
    chat_resp = client.post(
        "/api/chat",
        json={"message": "First turn", "provider": "openrouter", "model": "openrouter/free"},
    ).json()
    cid = chat_resp["conversation_id"]

    listing = client.get("/api/conversations")
    assert listing.status_code == 200
    ids = [c["id"] for c in listing.json()]
    assert cid in ids

    detail = client.get(f"/api/conversations/{cid}")
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["id"] == cid
    assert [m["role"] for m in payload["messages"]] == ["user", "assistant"]
    assert payload["messages"][0]["content"] == "First turn"

    deleted = client.delete(f"/api/conversations/{cid}")
    assert deleted.status_code == 204
    assert client.get(f"/api/conversations/{cid}").status_code == 404
