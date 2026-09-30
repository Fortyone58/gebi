import time
from datetime import datetime, timedelta, timezone


CN = timezone(timedelta(hours=8))


def freshness(created_at: int, now: int | None = None) -> dict[str, str]:
    current = now if now is not None else int(time.time())
    hours = max(0.0, (current - created_at) / 3600)
    if hours < 24:
        return {"level": "fresh24", "label": "刚上架"}
    if hours < 72:
        return {"level": "fresh72", "label": "新上架"}
    return {"level": "old", "label": f"已上架{int(hours // 24)}天"}


def like_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def month_range_epoch(now: datetime | None = None) -> tuple[int, int]:
    current = now.astimezone(CN) if now is not None else datetime.now(CN)
    start = current.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if start.month == 12:
        next_month = start.replace(year=start.year + 1, month=1)
    else:
        next_month = start.replace(month=start.month + 1)
    return int(start.timestamp()), int(next_month.timestamp())


def fmt_duration(seconds: int) -> str:
    seconds = max(0, seconds)
    if seconds < 3600:
        return f"{seconds // 60} 分钟"
    if seconds < 86400:
        hours, remainder = divmod(seconds, 3600)
        return f"{hours} 小时 {remainder // 60} 分"
    days, remainder = divmod(seconds, 86400)
    return f"{days} 天 {remainder // 3600} 小时"
