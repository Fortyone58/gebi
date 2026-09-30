from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt


TradeMode = Literal["free", "pay_what_you_want", "priced"]
ItemStatus = Literal["available", "given_away"]
FreshnessLevel = Literal["fresh24", "fresh72", "old"]


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=20)
    room_no: str | None = Field(default=None, max_length=20)
    avatar_emoji: str | None = Field(default=None, max_length=20)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    room_no: str | None
    avatar_emoji: str | None


class FreshnessOut(BaseModel):
    level: FreshnessLevel
    label: str


class ItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=60)
    description: str = Field(default="", max_length=1000)
    trade_mode: TradeMode
    price: StrictInt | None = None
    image_url: str | None = None


class GiveAwayRequest(BaseModel):
    to_user_id: StrictInt | None = Field(default=None, ge=1)


class ItemOut(BaseModel):
    id: int
    title: str
    description: str
    image_url: str | None
    trade_mode: TradeMode
    price: int | None
    status: ItemStatus
    owner: UserOut
    created_at: int
    given_away_at: int | None
    given_to_user_id: int | None
    want_count: int
    freshness: FreshnessOut
    is_mine: bool
    i_want: bool


class ItemDetail(ItemOut):
    pass


class ItemPage(BaseModel):
    items: list[ItemOut]
    total: int


class WantResult(BaseModel):
    want_count: int
    i_want: Literal[True]


class WantUser(BaseModel):
    id: int
    name: str
    avatar_emoji: str | None


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=200)


class MessageOut(BaseModel):
    id: int
    item_id: int
    user: UserOut
    content: str
    created_at: int


class MessageList(BaseModel):
    messages: list[MessageOut]


class StatsFastest(BaseModel):
    item: ItemOut
    took_seconds: int


class MostWanted(BaseModel):
    item: ItemOut
    want_count: int


class StatsOut(BaseModel):
    this_month_published: int
    this_month_completed: int
    available_count: int
    fastest: StatsFastest | None
    most_wanted: list[MostWanted]


class PriceSuggestRequest(BaseModel):
    title: str = Field(min_length=1, max_length=60)
    description: str = Field(default="", max_length=1000)


class PolishRequest(BaseModel):
    title: str = Field(min_length=1, max_length=60)
    description: str = Field(min_length=1, max_length=1000)


class FAQRequest(BaseModel):
    item_id: StrictInt = Field(ge=1)
    question: str = Field(min_length=1, max_length=200)


class PriceSuggestOut(BaseModel):
    source: Literal["llm", "fallback"]
    mode: Literal["priced", "free"]
    min: int
    max: int
    reason: str


class PolishOut(BaseModel):
    source: Literal["llm", "fallback"]
    title: str
    description: str


class FAQOut(BaseModel):
    source: Literal["llm", "fallback"]
    reply: str
