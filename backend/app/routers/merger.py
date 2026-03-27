from fastapi import APIRouter
from app.models.schemas import MergerInput
from app.engines.merger import build_merger_model

router = APIRouter()


@router.post("/run")
def run_merger_model(inp: MergerInput):
    return build_merger_model(inp)
