import time

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import current_user, get_db
from app.models import Item, Message, User, Want
from app.schemas import MessageCreate, MessageList, MessageOut, UserOut, WantResult, WantUser


router = APIRouter(prefix="/api/items", tags=["interactions"])


def _want_count(db: Session, item_id: int) -> int:
    return int(db.scalar(select(func.count(Want.id)).where(Want.item_id == item_id)) or 0)


def _require_item(db: Session, item_id: int) -> Item:
    item = db.get(Item, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="物品不存在")
    return item


@router.post("/{item_id}/wants", response_model=WantResult, status_code=201)
def want_item(
    item_id: int,
    response: Response,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> WantResult:
    item = _require_item(db, item_id)
    if item.owner_id == user.id:
        raise HTTPException(status_code=400, detail="不能想要自己发布的物品")
    if item.status != "available":
        raise HTTPException(status_code=409, detail="该物品已被送出")

    existing = db.scalar(
        select(Want.id).where(Want.item_id == item_id, Want.user_id == user.id)
    )
    if existing is not None:
        response.status_code = 200
        return WantResult(want_count=_want_count(db, item_id), i_want=True)

    db.add(Want(item_id=item_id, user_id=user.id, created_at=int(time.time())))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.scalar(
            select(Want.id).where(Want.item_id == item_id, Want.user_id == user.id)
        )
        if existing is None:
            raise HTTPException(status_code=409, detail="暂时无法记录想要状态") from None
        response.status_code = 200
        return WantResult(want_count=_want_count(db, item_id), i_want=True)
    return WantResult(want_count=_want_count(db, item_id), i_want=True)


@router.delete("/{item_id}/wants", status_code=204)
def cancel_want(
    item_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Response:
    _require_item(db, item_id)
    db.execute(delete(Want).where(Want.item_id == item_id, Want.user_id == user.id))
    db.commit()
    return Response(status_code=204)


@router.get("/{item_id}/wants", response_model=list[WantUser])
def list_wants(
    item_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[WantUser]:
    item = _require_item(db, item_id)
    if item.owner_id != user.id:
        raise HTTPException(status_code=403, detail="只有发布者可以查看想要名单")
    rows = db.execute(
        select(User.id, User.name, User.avatar_emoji)
        .join(Want, Want.user_id == User.id)
        .where(Want.item_id == item_id)
        .order_by(Want.created_at, Want.id)
    ).all()
    return [WantUser(id=row.id, name=row.name, avatar_emoji=row.avatar_emoji) for row in rows]


@router.get("/{item_id}/messages", response_model=MessageList)
def list_messages(item_id: int, db: Session = Depends(get_db)) -> MessageList:
    _require_item(db, item_id)
    rows = db.execute(
        select(Message, User)
        .join(User, User.id == Message.user_id)
        .where(Message.item_id == item_id)
        .order_by(Message.created_at.asc(), Message.id.asc())
    ).all()
    messages = [
        MessageOut(
            id=message.id,
            item_id=message.item_id,
            user=UserOut(
                id=author.id,
                name=author.name,
                room_no=author.room_no,
                avatar_emoji=author.avatar_emoji,
            ),
            content=message.content,
            created_at=message.created_at,
        )
        for message, author in rows
    ]
    return MessageList(messages=messages)


@router.post("/{item_id}/messages", response_model=MessageOut, status_code=201)
def create_message(
    item_id: int,
    payload: MessageCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    item = _require_item(db, item_id)
    if item.status != "available":
        raise HTTPException(status_code=409, detail="该物品已被送出，暂不能留言")
    content = payload.content.strip()
    if not 1 <= len(content) <= 200:
        raise HTTPException(status_code=400, detail="留言需为 1 至 200 个字符")

    message = Message(
        item_id=item_id,
        user_id=user.id,
        content=content,
        created_at=int(time.time()),
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return MessageOut(
        id=message.id,
        item_id=message.item_id,
        user=UserOut(
            id=user.id,
            name=user.name,
            room_no=user.room_no,
            avatar_emoji=user.avatar_emoji,
        ),
        content=message.content,
        created_at=message.created_at,
    )
