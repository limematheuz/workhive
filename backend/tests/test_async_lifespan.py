from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app import main


@pytest.mark.asyncio
async def test_lifespan_disposes_async_database_pool(monkeypatch):
    dispose = AsyncMock()
    monkeypatch.setattr(main.settings, "RUN_CALENDAR_BACKGROUND_SYNC", False)
    monkeypatch.setattr(main, "async_engine", SimpleNamespace(dispose=dispose))

    async with main.lifespan(main.app):
        pass

    dispose.assert_awaited_once_with()
