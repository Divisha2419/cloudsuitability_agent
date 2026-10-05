"""Admin login for the Admin page.

Credentials come from config/admin.yaml. A successful login returns a random
token, kept in memory for TOKEN_HOURS; restarting the app logs everyone out.
"""

from __future__ import annotations

import hmac
import secrets
import time
from functools import lru_cache

import yaml
from fastapi import Header, HTTPException

from .schema import CONFIG_DIR

TOKEN_HOURS = 8
_tokens: dict[str, float] = {}  # token -> expiry (epoch seconds)


@lru_cache
def credentials() -> tuple[str, str] | None:
    path = CONFIG_DIR / "admin.yaml"
    if not path.is_file():
        return None
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    username, password = data.get("username"), data.get("password")
    if not username or not password:
        return None
    return str(username), str(password)


def login(username: str, password: str) -> str | None:
    creds = credentials()
    if creds is None:
        return None
    ok_user = hmac.compare_digest(username.encode(), creds[0].encode())
    ok_pass = hmac.compare_digest(password.encode(), creds[1].encode())
    if not (ok_user and ok_pass):
        return None
    token = secrets.token_urlsafe(32)
    _tokens[token] = time.time() + TOKEN_HOURS * 3600
    return token


def logout(token: str) -> None:
    _tokens.pop(token, None)


def require_admin(authorization: str = Header(default="")) -> str:
    """FastAPI dependency: 401 unless the request carries a valid admin token."""
    token = authorization.removeprefix("Bearer ").strip()
    expiry = _tokens.get(token)
    if not token or expiry is None or expiry < time.time():
        _tokens.pop(token, None)
        raise HTTPException(401, "Please log in as admin")
    return token
