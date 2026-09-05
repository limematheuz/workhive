import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.api.deps import get_async_db
from app.core.security import create_access_token
from app.main import app
from app.models.company import Company
from app.models.role import Role
from app.models.user import User
from app.repositories import async_user as async_user_repo
from app.schemas.user import UserResponse
from app.services import organization_bootstrap_service, user_service


@pytest_asyncio.fixture()
async def async_user_session_factory():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        poolclass=StaticPool,
    )
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    try:
        async with factory() as session:
            role = Role(name="admin", description="Admin")
            company = Company(
                name="Async Company",
                tax_id="ASYNC-USER-1",
                address="Async Street 1",
                phone="600000000",
                email="async-company@example.test",
                subscription_plan="pro",
                subscription_status="active",
            )
            session.add_all([role, company])
            await session.flush()
            user = User(
                email="async-user@example.com",
                hashed_password="unused",
                full_name="Async User",
                role_id=role.id,
                company_id=company.id,
            )
            session.add(user)
            await session.flush()
            await session.run_sync(
                lambda db: organization_bootstrap_service.ensure_user_membership(
                    db, user
                )
            )
            await session.commit()
        yield factory
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_current_user_serializes_without_async_lazy_loading(
    async_user_session_factory,
):
    async with async_user_session_factory() as session:
        user = await async_user_repo.get_user_by_email(
            session, "async-user@example.com"
        )

        response = UserResponse.model_validate(user)

    assert response.email == "async-user@example.com"
    assert response.role is not None
    assert response.active_location_id is None


@pytest.mark.asyncio
async def test_company_user_list_serializes_without_async_lazy_loading(
    async_user_session_factory,
):
    async with async_user_session_factory() as session:
        current_user = await async_user_repo.get_user_by_email(
            session, "async-user@example.com"
        )
        users = await session.run_sync(
            lambda db: user_service.get_users(db, current_user, 0, 100)
        )

        responses = [UserResponse.model_validate(user) for user in users]

    assert [response.email for response in responses] == [
        "async-user@example.com"
    ]
    assert responses[0].role is not None
    assert responses[0].active_location_name is None


@pytest.mark.asyncio
async def test_async_user_http_endpoints_return_serializable_profiles(
    async_user_session_factory,
):
    async def override_get_async_db():
        async with async_user_session_factory() as session:
            yield session

    app.dependency_overrides[get_async_db] = override_get_async_db
    token = create_access_token({"sub": "async-user@example.com", "ver": 0})
    headers = {"Authorization": f"Bearer {token}"}
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            me_response = await client.get("/api/v1/users/me", headers=headers)
            users_response = await client.get("/api/v1/users/", headers=headers)
    finally:
        app.dependency_overrides.pop(get_async_db, None)

    assert me_response.status_code == 200
    assert me_response.json()["active_location_id"] is None
    assert users_response.status_code == 200
    assert [user["email"] for user in users_response.json()] == [
        "async-user@example.com"
    ]
