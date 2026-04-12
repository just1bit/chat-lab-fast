from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    active_provider: str = "openrouter"
    active_model: str = "meta-llama/llama-3-8b-instruct:free"

    openrouter_api_key: str = ""
    openai_api_key: str = ""
    groq_api_key: str = ""
    together_api_key: str = ""

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/cs732_chatbot"
    frontend_origin: str = "http://localhost:5173"

    enable_local_models: bool = False


settings = Settings()
