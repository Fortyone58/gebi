from sqlalchemy import CheckConstraint, ForeignKey, Index, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("length(trim(name)) BETWEEN 1 AND 20", name="ck_users_name_length"),
        CheckConstraint("room_no IS NULL OR length(room_no) <= 20", name="ck_users_room_length"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    room_no: Mapped[str | None] = mapped_column(Text)
    avatar_emoji: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[int] = mapped_column(nullable=False)


class Item(Base):
    __tablename__ = "items"
    __table_args__ = (
        CheckConstraint("length(trim(title)) BETWEEN 1 AND 60", name="ck_items_title_length"),
        CheckConstraint("length(description) <= 1000", name="ck_items_description_length"),
        CheckConstraint(
            "trade_mode IN ('free','pay_what_you_want','priced')",
            name="ck_items_trade_mode",
        ),
        CheckConstraint("price IS NULL OR price BETWEEN 1 AND 999999", name="ck_items_price_range"),
        CheckConstraint("status IN ('available','given_away')", name="ck_items_status"),
        CheckConstraint(
            "(trade_mode = 'priced') = (price IS NOT NULL)",
            name="ck_items_price_matches_mode",
        ),
        CheckConstraint(
            "(status = 'given_away') = (given_away_at IS NOT NULL)",
            name="ck_items_status_matches_given_away_at",
        ),
        CheckConstraint(
            "given_away_at IS NULL OR given_away_at >= created_at",
            name="ck_items_given_away_after_created",
        ),
        CheckConstraint(
            "given_to_user_id IS NULL OR status = 'given_away'",
            name="ck_items_recipient_requires_given_away",
        ),
        Index("idx_items_status_created", "status", text("created_at DESC")),
        Index("idx_items_owner", "owner_id"),
        Index("idx_items_mode", "trade_mode"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default=text("''"))
    image_url: Mapped[str | None] = mapped_column(Text)
    trade_mode: Mapped[str] = mapped_column(Text, nullable=False)
    price: Mapped[int | None]
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default="available", server_default=text("'available'")
    )
    created_at: Mapped[int] = mapped_column(nullable=False)
    given_away_at: Mapped[int | None]
    given_to_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class Want(Base):
    __tablename__ = "wants"
    __table_args__ = (
        UniqueConstraint("item_id", "user_id", name="uq_wants_item_user"),
        Index("idx_wants_item", "item_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[int] = mapped_column(nullable=False)


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint("length(trim(content)) BETWEEN 1 AND 200", name="ck_messages_content_length"),
        Index("idx_messages_item", "item_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[int] = mapped_column(nullable=False)
