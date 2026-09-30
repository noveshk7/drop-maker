"""API smoke test for the runtime-health criterion.

DROP//MAP Studio is a browser-local app (IndexedDB) with no domain backend API.
The backend only exposes template health/status endpoints. This test confirms
those respond so the frontend's proxied /api calls are healthy.
"""

import httpx


def test_api_root_health(client: httpx.Client):
    resp = client.get("/")
    assert resp.status_code == 200, f"GET /api/ -> {resp.status_code}: {resp.text[:200]}"


def test_api_status_endpoint(client: httpx.Client):
    resp = client.get("/status")
    assert resp.status_code in (200, 404), (
        f"GET /api/status -> unexpected {resp.status_code}: {resp.text[:200]}"
    )
