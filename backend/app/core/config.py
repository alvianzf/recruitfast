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
    # Browsers treat localhost and 127.0.0.1 as distinct origins even
    # though they resolve to the same machine — both are allowed so the
    # dev server works regardless of which host the frontend binds to.
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    # Used to build absolute URLs for uploaded images (org logos, user
    # avatars) returned by POST /uploads/image — the frontend and backend
    # run on different origins, so a relative /media/... path would
    # resolve against the frontend's own origin instead of the API's.
    public_base_url: str = "http://127.0.0.1:8000"
    # The frontend SPA's own public origin — where job board/apply pages
    # actually live (a different origin from public_base_url above in
    # dev). Used to build absolute URLs in sitemap.xml and the social-share
    # preview page, since both need a real, crawlable URL, not a relative
    # path resolved against whichever origin served the request.
    frontend_base_url: str = "http://localhost:5173"

    # Optional LLM-based CV parsing layer (see app/services/llm_cv_parser.py
    # and docs/04-cv-parser.md). None/empty disables it entirely and the
    # app falls back to the rule-based parser only — this is not a
    # required credential for the app to run.
    llm_api_key: str | None = None
    llm_base_url: str = "https://ai.sumopod.com/v1"
    llm_model: str = "gemini/gemini-3.1-flash-lite"


settings = Settings()
