import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.routers import (
    admin,
    auth,
    blacklist,
    bulk_import,
    candidates,
    clients,
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
    uploads,
    users,
)
from app.core.config import settings
from app.core.limiter import limiter
from app.services.storage import PUBLIC_ROOT

app = FastAPI(title="FastRecruit API", version="0.5.5")

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
    # settings.cors_origins' local-dev default already lists both
    # localhost and 127.0.0.1 (the two origins that used to motivate a
    # wildcard here), and production's .env overrides it to the real
    # frontend origin — see docs/11-security-review.md, this closes a
    # previously-documented "tighten before this goes near the internet"
    # gap now that the app is actually deployed. allow_credentials stays
    # False either way; auth is a Bearer token in the Authorization
    # header, not a cookie.
    allow_origins=settings.cors_origins,
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
app.include_router(public_board.root_router)
app.include_router(screening.router)
app.include_router(blacklist.router)
app.include_router(teams.router)
app.include_router(uploads.router)
app.include_router(users.router)
app.include_router(clients.router)

# Uploaded org logos and user avatars — plain static serving since these
# render unauthenticated on the public job board. Not for candidate CVs,
# which stay behind the authenticated /candidates/{id}/cv endpoint.
app.mount("/media", StaticFiles(directory=str(PUBLIC_ROOT)), name="media")
