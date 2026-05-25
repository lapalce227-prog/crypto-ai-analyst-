from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # DeepSeek
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    # OKX
    okx_api_key: str = ""
    okx_api_secret: str = ""
    okx_api_passphrase: str = ""
    okx_base_url: str = "https://www.okx.com"
    # JWT
    secret_key: str = "crypto-ai-analyst-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_hours: int = 24
    # Vision API (OpenAI-compatible, for chart/image analysis)
    vision_api_key: str = ""
    vision_base_url: str = "https://api.openai.com"
    vision_model: str = "gpt-4o"
    # OpenAI (agent tool calling)
    openai_api_key: str = ""
    openai_model: str = "gpt-5-mini"
    # DashScope / 千问 (国内 agent)
    dash_api_key: str = ""
    dash_model: str = "qwen-plus"
    # Server
    port: int = 8000
    # CryptoPanic
    cryptopanic_token: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
