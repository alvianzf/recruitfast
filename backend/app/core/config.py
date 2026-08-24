from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # No real credentials here — set DATABASE_URL / JWT_SECRET in a local,
    # gitignored .env (see .env.example). These are placeholders only.
    database_url: str = "postgresql+psycopg://user:password@localhost:5432/recruitfast"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
