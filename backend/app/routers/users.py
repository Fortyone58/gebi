import time

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import current_user, get_db
from app.models import User
from app.schemas import UserCreate, UserOut


router = APIRouter(prefix="/api", tags=["users"])


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)) -> list[User]:
    return list(db.scalars(select(User).order_by(User.id)).all())


@router.post("/users", response_model=UserOut, status_code=201)
def create_or_get_user(
    payload: UserCreate,
    response: Response,
    db: Session = Depends(get_db),
) -> User:
    name = payload.name.strip()
    if not 1 <= len(name) <= 20:
        raise HTTPException(status_code=400, detail="姓名需为 1 至 20 个字符")
    existing = db.scalar(select(User).where(User.name == name))
    if existing is not None:
        response.status_code = 200
        return existing

    user = User(
        name=name,
        room_no=payload.room_no,
        avatar_emoji=payload.avatar_emoji,
        created_at=int(time.time()),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.scalar(select(User).where(User.name == name))
        if existing is None:
            raise HTTPException(status_code=400, detail="无法创建住户") from None
        response.status_code = 200
        return existing
    db.refresh(user)
    return user


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(current_user)) -> User:
    return user
