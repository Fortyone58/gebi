from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import current_user, get_db
from app.models import Item, User
from app.schemas import (
    FAQOut,
    FAQRequest,
    PolishOut,
    PolishRequest,
    PriceSuggestOut,
    PriceSuggestRequest,
)
from app.services.llm import faq_reply, polish_copy, suggest_price


router = APIRouter(prefix="/api/llm", tags=["llm"])


@router.post("/price-suggest", response_model=PriceSuggestOut)
def price_suggest(payload: PriceSuggestRequest, _user: User = Depends(current_user)) -> PriceSuggestOut:
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="物品名称不能为空")
    return PriceSuggestOut(**suggest_price(title, payload.description))


@router.post("/polish", response_model=PolishOut)
def polish(payload: PolishRequest, _user: User = Depends(current_user)) -> PolishOut:
    title = payload.title.strip()
    if not title or not payload.description.strip():
        raise HTTPException(status_code=400, detail="物品名称和描述不能为空")
    return PolishOut(**polish_copy(title, payload.description))


@router.post("/faq-reply", response_model=FAQOut)
def faq(
    payload: FAQRequest,
    _current_user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> FAQOut:
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="问题不能为空")
    row = db.execute(
        select(Item, User.room_no)
        .join(User, User.id == Item.owner_id)
        .where(Item.id == payload.item_id)
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="物品不存在")
    item, room_no = row
    return FAQOut(**faq_reply(item, room_no, question))
