from fastapi import APIRouter

router = APIRouter()


@router.post("/chat")
async def chat_placeholder() -> dict[str, str]:
    return {"status": "not-implemented"}
