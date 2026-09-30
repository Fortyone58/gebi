import logging
import sys
import time

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import Base, engine
from app.routers import interactions, items, llm, stats, users


for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gebi")

app = FastAPI(title="隔壁 · 楼里的闲置流转", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
def validation_error_handler(_request: Request, _exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": "请求参数无效"})


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
    if not (settings.llm_api_key or "").strip():
        logger.warning("LLM_API_KEY 未配置，AI 接口将使用规则兜底")


@app.get("/api/ping")
def ping() -> dict[str, int | bool]:
    return {"ok": True, "ts": int(time.time())}


app.include_router(users.router)
app.include_router(items.router)
app.include_router(interactions.router)
app.include_router(stats.router)
app.include_router(llm.router)
