import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import database as db_module
from app.db.database import Base, get_db
from app.main import app


@pytest.fixture(autouse=True)
def _isolated_db(monkeypatch):
    """Give every test a fresh in-memory SQLite database.

    Routes that use the `get_db` dependency are wired up via `dependency_overrides`.
    The streaming route opens sessions directly through `db_module.SessionLocal`,
    so we monkeypatch that too — both paths then bind to the same in-memory engine.
    """
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(
        bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
    )

    # Make sure ORM models are registered before create_all.
    from app.db import models as _orm  # noqa: F401

    Base.metadata.create_all(bind=engine)

    def override_get_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(db_module, "SessionLocal", TestingSession)

    yield

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
