from __future__ import annotations

import importlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db_path = tmp_path / "operon-test.db"
    monkeypatch.setenv("OPERON_DB_PATH", str(db_path))
    monkeypatch.setenv("OPERON_DISABLE_SCHEDULER", "1")
    monkeypatch.setenv("OPERON_DISABLE_STARTUP_INGEST", "1")

    import backend.database as database
    import backend.main as main

    importlib.reload(database)
    importlib.reload(main)
    main.NORMALIZATION_BATCHES.clear()
    main.REVIEW_DECISIONS.clear()

    with TestClient(main.app) as test_client:
        yield test_client
