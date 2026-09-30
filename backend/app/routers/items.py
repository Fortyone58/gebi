import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import exists, func, literal, or_, select, update
from sqlalchemy.orm import Session

from app.deps import current_user, get_db, optional_user_id
from app.models import Item, User, Want
from app.schemas import (
    GiveAwayRequest,
    ItemCreate,
    ItemDetail,
    ItemOut,
    ItemPage,
    TradeMode,
    UserOut,
)
from app.utils import freshness, like_escape


router = APIRouter(prefix="/api/items", tags=["items"])


def _base_item_query(user_id: int | None):
    counts = (
        select(Want.item_id, func.count(Want.id).label("want_count"))
        .group_by(Want.item_id)
        .subquery()
    )
    i_want = (
        exists(select(1).where(Want.item_id == Item.id, Want.user_id == user_id))
        if user_id is not None
        else literal(False)
    )
    return (
        select(Item, User, func.coalesce(counts.c.want_count, 0), i_want)
        .join(User, User.id == Item.owner_id)
        .outerjoin(counts, counts.c.item_id == Item.id)
    )


def _serialize_item(
    item: Item,
    owner: User,
    want_count: int,
    i_want: bool,
    user_id: int | None,
    now: int | None = None,
) -> ItemOut:
    return ItemOut(
        id=item.id,
        title=item.title,
        description=item.description,
        image_url=item.image_url,
        trade_mode=item.trade_mode,
        price=item.price,
        status=item.status,
        owner=UserOut(
            id=owner.id,
            name=owner.name,
            room_no=owner.room_no,
            avatar_emoji=owner.avatar_emoji,
        ),
        created_at=item.created_at,
        given_away_at=item.given_away_at,
        given_to_user_id=item.given_to_user_id,
        want_count=int(want_count),
        freshness=freshness(item.created_at, now),
        is_mine=user_id == item.owner_id if user_id is not None else False,
        i_want=bool(i_want),
    )


def get_item_out(db: Session, item_id: int, user_id: int | None = None) -> ItemOut:
    row = db.execute(_base_item_query(user_id).where(Item.id == item_id)).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="物品不存在")
    item, owner, want_count, i_want = row
    return _serialize_item(item, owner, want_count, i_want, user_id)


@router.get("", response_model=ItemPage)
def list_items(
    status: str = "available",
    trade_mode: TradeMode | None = None,
    q: str | None = None,
    owner: str | None = None,
    sort: str = "fresh",
    limit: int = 20,
    offset: int = 0,
    user_id: int | None = Depends(optional_user_id),
    db: Session = Depends(get_db),
) -> ItemPage:
    if status not in {"available", "given_away", "all"}:
        raise HTTPException(status_code=400, detail="物品状态无效")
    if owner not in {None, "me"}:
        raise HTTPException(status_code=400, detail="owner 仅支持 me")
    if sort not in {"fresh", "oldest"}:
        raise HTTPException(status_code=400, detail="排序方式无效")
    if limit < 1 or offset < 0:
        raise HTTPException(status_code=400, detail="limit 或 offset 无效")

    filters = []
    if status != "all":
        filters.append(Item.status == status)
    if trade_mode is not None:
        filters.append(Item.trade_mode == trade_mode)
    if owner == "me":
        filters.append(Item.owner_id == (user_id if user_id is not None else -1))
    query = (q or "").strip()[:50]
    if query:
        pattern = f"%{like_escape(query)}%"
        filters.append(
            or_(
                Item.title.ilike(pattern, escape="\\"),
                Item.description.ilike(pattern, escape="\\"),
            )
        )

    total = int(db.scalar(select(func.count(Item.id)).where(*filters)) or 0)
    ordering = (
        (Item.created_at.desc(), Item.id.desc())
        if sort == "fresh"
        else (Item.created_at.asc(), Item.id.asc())
    )
    rows = db.execute(
        _base_item_query(user_id)
        .where(*filters)
        .order_by(*ordering)
        .limit(min(limit, 100))
        .offset(offset)
    ).all()
    now = int(time.time())
    items = [
        _serialize_item(item, item_owner, want_count, i_want, user_id, now)
        for item, item_owner, want_count, i_want in rows
    ]
    return ItemPage(items=items, total=total)


@router.get("/{item_id}", response_model=ItemDetail)
def get_item(
    item_id: int,
    user_id: int | None = Depends(optional_user_id),
    db: Session = Depends(get_db),
) -> ItemDetail:
    return ItemDetail(**get_item_out(db, item_id, user_id).model_dump())


@router.post("", response_model=ItemOut, status_code=201)
def create_item(
    payload: ItemCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> ItemOut:
    title = payload.title.strip()
    if not 1 <= len(title) <= 60:
        raise HTTPException(status_code=400, detail="标题需为 1 至 60 个字符")
    if len(payload.description) > 1000:
        raise HTTPException(status_code=400, detail="描述不能超过 1000 个字符")
    if payload.trade_mode == "priced":
        if payload.price is None or not 1 <= payload.price <= 999999:
            raise HTTPException(status_code=400, detail="标价物品需填写 1 至 999999 元的整数价格")
        price = payload.price
    else:
        price = None

    item = Item(
        owner_id=user.id,
        title=title,
        description=payload.description,
        image_url=payload.image_url,
        trade_mode=payload.trade_mode,
        price=price,
        status="available",
        created_at=int(time.time()),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return get_item_out(db, item.id, user.id)


@router.post("/{item_id}/give-away", response_model=ItemOut)
def give_away_item(
    item_id: int,
    payload: GiveAwayRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> ItemOut:
    item = db.get(Item, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="物品不存在")
    if item.owner_id != user.id:
        raise HTTPException(status_code=403, detail="只有发布者可以标记已送出")
    if payload.to_user_id == user.id:
        raise HTTPException(status_code=400, detail="不能将物品标记为送给自己")
    if payload.to_user_id is not None and db.get(User, payload.to_user_id) is None:
        raise HTTPException(status_code=404, detail="接收住户不存在")

    now = max(int(time.time()), item.created_at)
    result = db.execute(
        update(Item)
        .where(
            Item.id == item_id,
            Item.owner_id == user.id,
            Item.status == "available",
        )
        .values(
            status="given_away",
            given_away_at=now,
            given_to_user_id=payload.to_user_id,
        )
        .execution_options(synchronize_session=False)
    )
    db.commit()
    if result.rowcount == 0:
        current = db.get(Item, item_id)
        if current is None:
            raise HTTPException(status_code=404, detail="物品不存在")
        if current.owner_id != user.id:
            raise HTTPException(status_code=403, detail="只有发布者可以标记已送出")
        raise HTTPException(status_code=409, detail="该物品已被标记为已送出")
    db.expire_all()
    return get_item_out(db, item_id, user.id)
