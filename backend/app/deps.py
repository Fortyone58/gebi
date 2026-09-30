from collections.abc import Generator

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import User


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def current_user(
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    db: Session = Depends(get_db),
) -> User:
    if x_user_id is None:
        raise HTTPException(status_code=401, detail="身份已失效，请重新选择")
    try:
        user_id = int(x_user_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="身份已失效，请重新选择") from None
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="身份已失效，请重新选择")
    return user


def optional_user_id(
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    db: Session = Depends(get_db),
) -> int | None:
    if x_user_id is None:
        return None
    try:
        user_id = int(x_user_id)
    except (TypeError, ValueError):
        return None
    return user_id if db.scalar(select(User.id).where(User.id == user_id)) is not None else None
