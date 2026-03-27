from fastapi import APIRouter
from app.models.schemas import RealEstateInput
from app.engines.real_estate import build_real_estate_model

router = APIRouter()


@router.post("/run")
def run_real_estate_model(inp: RealEstateInput):
    return build_real_estate_model(inp)
