from fastapi import APIRouter
from fastapi.responses import Response
from app.models.schemas import (
    CorporateModelInput, ProjectFinanceInput, AcquisitionInput, MonteCarloInput
)
from app.routers.corporate import run_corporate_model
from app.routers.project_finance import run_project_model
from app.routers.acquisition import run_acquisition_model
from app.routers.risk_analysis import monte_carlo
from app.engines.excel_export import (
    export_corporate, export_project, export_acquisition, export_monte_carlo
)

router = APIRouter()

XLSX_HEADERS = {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


@router.post("/corporate")
def export_corporate_xlsx(inp: CorporateModelInput):
    result = run_corporate_model(inp)
    data = export_corporate(result, inp.model_dump())
    filename = f"{inp.name.replace(' ', '_')}_corporate.xlsx"
    return Response(
        content=data,
        headers={**XLSX_HEADERS, "Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/project")
def export_project_xlsx(inp: ProjectFinanceInput):
    result = run_project_model(inp)
    data = export_project(result, inp.model_dump())
    filename = f"{inp.name.replace(' ', '_')}_project.xlsx"
    return Response(
        content=data,
        headers={**XLSX_HEADERS, "Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/acquisition")
def export_acquisition_xlsx(inp: AcquisitionInput):
    result = run_acquisition_model(inp)
    data = export_acquisition(result, inp.model_dump())
    filename = f"{inp.name.replace(' ', '_')}_acquisition.xlsx"
    return Response(
        content=data,
        headers={**XLSX_HEADERS, "Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/monte-carlo")
def export_mc_xlsx(inp: MonteCarloInput):
    result = monte_carlo(inp)
    data = export_monte_carlo(result, inp.model_dump())
    return Response(
        content=data,
        headers={**XLSX_HEADERS, "Content-Disposition": 'attachment; filename="monte_carlo.xlsx"'},
    )
