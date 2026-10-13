"""HTTP sessions with bounded exponential retries for public GET APIs."""

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


def create_session(headers: dict[str, str]) -> requests.Session:
    session = requests.Session()
    session.headers.update(headers)
    retry = Retry(
        total=5, backoff_factor=1, allowed_methods={"GET"},
        status_forcelist=[429, 500, 502, 503, 504],
        respect_retry_after_header=True,
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    return session
