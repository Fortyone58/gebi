from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import Item, Want
from app.routers.items import _base_item_query, _serialize_item
from app.schemas import MostWanted, StatsFastest, StatsOut
from app.utils import month_range_epoch


router = APIRouter(prefix="/api", tags=["stats"])


@router.get("/stats", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db)) -> StatsOut:
    month_start, next_month_start = month_range_epoch()
    this_month_published = int(
        db.scalar(
            select(func.count(Item.id)).where(
                Item.created_at >= month_start,
                Item.created_at < next_month_start,
            )
        )
        or 0
    )
    this_month_completed = int(
        db.scalar(
            select(func.count(Item.id)).where(
                Item.given_away_at >= month_start,
                Item.given_away_at < next_month_start,
            )
        )
        or 0
    )
    available_count = int(
        db.scalar(select(func.count(Item.id)).where(Item.status == "available")) or 0
    )

    elapsed = Item.given_away_at - Item.created_at
    fastest_row = db.execute(
        _base_item_query(None)
        .where(Item.status == "given_away")
        .order_by(elapsed.asc(), Item.given_away_at.asc(), Item.id.asc())
        .limit(1)
    ).one_or_none()
    fastest = None
    if fastest_row is not None:
        item, owner, want_count, i_want = fastest_row
        fastest = StatsFastest(
            item=_serialize_item(item, owner, want_count, i_want, None),
            took_seconds=max(0, int(item.given_away_at - item.created_at)),
        )

    counts = (
        select(Want.item_id.label("item_id"), func.count(Want.id).label("want_count"))
        .join(Item, Item.id == Want.item_id)
        .where(Item.status == "available")
        .group_by(Want.item_id)
        .subquery()
    )
    max_count = select(func.max(counts.c.want_count)).scalar_subquery()
    wanted_rows = db.execute(
        _base_item_query(None)
        .join(counts, counts.c.item_id == Item.id)
        .where(Item.status == "available", counts.c.want_count == max_count)
        .order_by(Item.id.asc())
    ).all()
    most_wanted = [
        MostWanted(
            item=_serialize_item(item, owner, want_count, i_want, None),
            want_count=int(want_count),
        )
        for item, owner, want_count, i_want in wanted_rows
    ]
    return StatsOut(
        this_month_published=this_month_published,
        this_month_completed=this_month_completed,
        available_count=available_count,
        fastest=fastest,
        most_wanted=most_wanted,
    )
