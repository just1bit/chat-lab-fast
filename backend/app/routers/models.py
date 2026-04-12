from fastapi import APIRouter

router = APIRouter()


@router.get("/models")
async def list_models() -> dict[str, list]:
    return {"providers": []}
