"""Shared rate limiter instance — separate module so routers can import
it without a circular dependency on app.main (which registers it on the
FastAPI app). See docs/11-security-review.md.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
