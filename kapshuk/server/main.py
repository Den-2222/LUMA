"""API для Mini App + роздача зібраного фронтенду."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app import repo
from app.config import BASE_DIR, config
from app.dates import current_month
from app.db import init_db
from server.auth import current_user

DIST_DIR = BASE_DIR / "webapp" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


api = FastAPI(title="Капшук", lifespan=lifespan, docs_url=None, redoc_url=None)


class TransactionIn(BaseModel):
    kind: str = Field(pattern="^(income|expense)$")
    amount: int = Field(gt=0, le=10_000_000_000)  # копійки
    category_id: int | None = None
    note: str = ""
    occurred_at: str | None = None


class CategoryIn(BaseModel):
    kind: str = Field(pattern="^(income|expense)$")
    name: str = Field(min_length=1, max_length=32)
    emoji: str = Field(default="🏷", max_length=8)


class CurrencyIn(BaseModel):
    currency: str = Field(pattern="^[A-Z]{3}$")


class BudgetIn(BaseModel):
    amount: int = Field(ge=0, le=10_000_000_000)


@api.get("/api/health")
async def health() -> dict:
    return {"ok": True}


@api.get("/api/me")
async def get_me(user: dict = Depends(current_user)) -> dict:
    return {"id": user["id"], "first_name": user["first_name"], "currency": user["currency"]}


@api.patch("/api/me")
async def patch_me(payload: CurrencyIn, user: dict = Depends(current_user)) -> dict:
    await repo.set_currency(user["id"], payload.currency)
    return {"ok": True, "currency": payload.currency}


@api.get("/api/categories")
async def get_categories(kind: str | None = None, user: dict = Depends(current_user)) -> list[dict]:
    if kind and kind not in ("income", "expense"):
        raise HTTPException(422, "bad kind")
    return await repo.list_categories(user["id"], kind)


@api.post("/api/categories", status_code=201)
async def post_category(payload: CategoryIn, user: dict = Depends(current_user)) -> dict:
    created = await repo.add_category(user["id"], payload.kind, payload.name, payload.emoji)
    if not created:
        raise HTTPException(409, "category already exists")
    return created


@api.delete("/api/categories/{category_id}")
async def delete_category(category_id: int, user: dict = Depends(current_user)) -> dict:
    if not await repo.archive_category(user["id"], category_id):
        raise HTTPException(404, "not found")
    return {"ok": True}


@api.get("/api/summary")
async def get_summary(month: str | None = None, user: dict = Depends(current_user)) -> dict:
    return await repo.summary(user["id"], month or current_month())


@api.get("/api/transactions")
async def get_transactions(
    month: str | None = None,
    kind: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(current_user),
) -> list[dict]:
    return await repo.list_transactions(user["id"], month, kind, limit, offset)


@api.post("/api/transactions", status_code=201)
async def post_transaction(payload: TransactionIn, user: dict = Depends(current_user)) -> dict:
    if payload.category_id:
        owned = {c["id"] for c in await repo.list_categories(user["id"], payload.kind)}
        if payload.category_id not in owned:
            raise HTTPException(422, "unknown category")
    return await repo.add_transaction(
        user["id"], payload.kind, payload.amount, payload.category_id, payload.note, payload.occurred_at
    )


@api.delete("/api/transactions/{tx_id}")
async def delete_transaction(tx_id: int, user: dict = Depends(current_user)) -> dict:
    if not await repo.delete_transaction(user["id"], tx_id):
        raise HTTPException(404, "not found")
    return {"ok": True}


@api.get("/api/budgets")
async def get_budgets(month: str | None = None, user: dict = Depends(current_user)) -> list[dict]:
    return await repo.list_budgets(user["id"], month)


@api.put("/api/budgets/{category_id}")
async def put_budget(category_id: int, payload: BudgetIn, user: dict = Depends(current_user)) -> dict:
    if payload.amount == 0:
        await repo.delete_budget(user["id"], category_id)
        return {"ok": True, "removed": True}
    await repo.set_budget(user["id"], category_id, payload.amount)
    return {"ok": True}


# ------------------------------------------------------------ фронтенд

if DIST_DIR.exists():
    api.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @api.get("/{full_path:path}")
    async def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404)
        candidate = (DIST_DIR / full_path).resolve()
        if full_path and candidate.is_file() and DIST_DIR.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(DIST_DIR / "index.html", headers={"Cache-Control": "no-store"})
else:
    @api.get("/")
    async def not_built() -> JSONResponse:
        return JSONResponse(
            {"detail": "Фронтенд не зібрано. Виконай: cd webapp && npm install && npm run build"},
            status_code=503,
        )


def run() -> None:
    import uvicorn

    uvicorn.run("server.main:api", host=config.host, port=config.port, reload=False)


if __name__ == "__main__":
    run()
