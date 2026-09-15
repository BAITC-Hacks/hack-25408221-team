from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.auth import get_current_user
from app.core.security import create_access_token
from app.domain.entities import UserCreate, UserLogin
from app.infrastructure.database import get_session
from app.infrastructure.repositories import SessionRepository, UserRepository
from app.use_cases.user_use_cases import (
    GetUserUseCase,
    ListUsersUseCase,
    LoginUserUseCase,
    RegisterUserUseCase,
)

router = APIRouter(prefix="/api", tags=["users"])
limiter = Limiter(key_func=get_remote_address)


def _get_register_use_case(db_session: AsyncSession = Depends(get_session)):
    return RegisterUserUseCase(UserRepository(db_session))


def _get_login_use_case(db_session: AsyncSession = Depends(get_session)):
    return LoginUserUseCase(UserRepository(db_session))


def _get_get_user_use_case(db_session: AsyncSession = Depends(get_session)):
    return GetUserUseCase(
        UserRepository(db_session),
        SessionRepository(db_session),
    )


def _get_list_users_use_case(db_session: AsyncSession = Depends(get_session)):
    return ListUsersUseCase(
        UserRepository(db_session),
        SessionRepository(db_session),
    )


@router.post("/register")
@limiter.limit("10/minute")
async def register(
    request: Request,
    payload: dict,
    use_case: RegisterUserUseCase = Depends(_get_register_use_case),
):
    try:
        user_create = UserCreate(**payload)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request body")

    user, error = await use_case.execute(user_create)
    if error:
        raise HTTPException(status_code=400, detail=error)

    access_token = create_access_token(
        data={"sub": user.id, "role": user.role},
        expires_delta=timedelta(hours=24),
    )
    return {"userId": user.id, "name": user.name, "accessToken": access_token}


@router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    payload: dict,
    use_case: LoginUserUseCase = Depends(_get_login_use_case),
):
    try:
        login_data = UserLogin(**payload)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request body")

    user, error = await use_case.execute(login_data)
    if error:
        raise HTTPException(status_code=401, detail=error)

    access_token = create_access_token(
        data={"sub": user.id, "role": user.role},
        expires_delta=timedelta(hours=24),
    )

    return {"userId": user.id, "name": user.name, "accessToken": access_token}


@router.get("/users")
async def list_users(
    current_user=Depends(get_current_user),
    use_case: ListUsersUseCase = Depends(_get_list_users_use_case),
):
    users = await use_case.execute()
    return users


@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    current_user=Depends(get_current_user),
    use_case: GetUserUseCase = Depends(_get_get_user_use_case),
):
    user_with_session, error = await use_case.execute(user_id)
    if error:
        raise HTTPException(status_code=404, detail=error)
    return user_with_session
