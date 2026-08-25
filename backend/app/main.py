import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.routers import (
    admin,
    auth,
    blacklist,
    bulk_import,
    candidates,
    freelance,
    health,
    jobs,
    metrics,
    notes,
    org,
    pipeline,
    public_board,
    screening,
    teams,
)
from app.core.config import settings
from app.core.limiter import limiter

app = FastAPI(title="RecruitFast API")

# JWT_SECRET's Pydantic default is a placeholder, never meant to be used
# for real — if it's still set, every access/refresh token this process
# issues is forgeable by anyone who reads the source. Loud startup
# warning rather than a hard failure, so a misconfigured local dev
# environment doesn't crash outright, but this should never be silent.
if settings.jwt_secret == "change-me":
    logging.getLogger("uvicorn.error").warning(
        "JWT_SECRET is still the default placeholder value — every token this "
        "process issues is forgeable. Set a real secret in backend/.env before "
        "this runs anywhere reachable outside your own machine."
    )

# Per-IP rate limiting on the endpoints that matter most: /auth/login
# (brute-force/credential-stuffing) and the public application/CV-upload
# paths (spam +, now that CV parsing can call a paid LLM API, a cost-abuse
# vector). See docs/11-security-review.md.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    # Wildcard for now to stop localhost-vs-127.0.0.1 origin mismatches
    # from blocking local dev — tighten to settings.cors_origins (or a
    # real production allowlist) before this goes anywhere near the
    # internet. allow_credentials must be False to pair with "*" (CORS
    # spec forbids the combination); harmless here since auth is a
    # Bearer token in the Authorization header, not a cookie.
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(freelance.router)
app.include_router(jobs.router)
app.include_router(candidates.router)
app.include_router(pipeline.router)
app.include_router(admin.router)
app.include_router(org.router)
app.include_router(notes.router)
app.include_router(metrics.router)
app.include_router(bulk_import.router)
app.include_router(public_board.router)
app.include_router(screening.router)
app.include_router(blacklist.router)
app.include_router(teams.router)
