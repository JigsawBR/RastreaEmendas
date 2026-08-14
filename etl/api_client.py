import logging
import time

import requests

from . import config

logger = logging.getLogger(__name__)

REQUESTS_PER_MINUTE = 90
MIN_INTERVAL = 60.0 / REQUESTS_PER_MINUTE
MAX_RETRIES = 5


class PortalClient:
    def __init__(self, api_key: str | None = None):
        key = api_key or config.API_KEY
        if not key:
            raise RuntimeError(
                "PORTAL_API_KEY is not set. Copy .env.example to .env and fill it in."
            )
        self.session = requests.Session()
        self.session.headers.update(
            {"chave-api-dados": key, "Accept": "application/json"}
        )
        self._last_request_at = 0.0

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < MIN_INTERVAL:
            time.sleep(MIN_INTERVAL - elapsed)

    def get(self, path: str, params: dict | None = None):
        url = f"{config.API_BASE_URL}{path}"
        backoff = 1.0
        for attempt in range(1, MAX_RETRIES + 1):
            self._throttle()
            try:
                response = self.session.get(url, params=params, timeout=30)
                self._last_request_at = time.monotonic()
            except requests.RequestException as exc:
                if attempt == MAX_RETRIES:
                    raise
                logger.warning("Request error (%s); retry in %.0fs", exc, backoff)
                time.sleep(backoff)
                backoff *= 2
                continue

            if response.status_code == 429 or response.status_code >= 500:
                if attempt == MAX_RETRIES:
                    response.raise_for_status()
                retry_after = response.headers.get("Retry-After")
                wait = float(retry_after) if retry_after and retry_after.isdigit() else backoff
                logger.warning(
                    "HTTP %d on %s; retry in %.0fs (attempt %d/%d)",
                    response.status_code, path, wait, attempt, MAX_RETRIES,
                )
                time.sleep(wait)
                backoff *= 2
                continue

            response.raise_for_status()
            return response.json()
