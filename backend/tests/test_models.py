def test_models_endpoint_lists_providers(client):
    response = client.get("/api/models")
    assert response.status_code == 200
    data = response.json()

    assert data["active_provider"] == "openrouter"
    assert data["active_model"] == "openrouter/free"

    names = [p["name"] for p in data["providers"]]
    assert "openrouter" in names
    assert "openai" in names
