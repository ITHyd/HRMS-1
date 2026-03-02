from fastapi import APIRouter, Depends

from app.middleware.auth_middleware import CurrentUser, get_current_user
from app.services.org_tree_service import (
    build_full_org_tree,
    get_branch_subtree,
    get_reporting_chain,
    trace_path,
)

router = APIRouter(prefix="/org", tags=["Org Tree"])


@router.get("/tree")
async def get_full_tree(user: CurrentUser = Depends(get_current_user)):
    return await build_full_org_tree(
        branch_location_id=user.branch_location_id,
        branch_head_id=user.employee_id,
    )


@router.get("/branch/{location_id}/tree")
async def get_branch_tree(
    location_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    return await get_branch_subtree(location_id, branch_head_id=user.employee_id)


@router.get("/chain/{employee_id}")
async def get_chain(
    employee_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    chain = await get_reporting_chain(employee_id)
    return {"chain": chain}


@router.get("/trace")
async def get_trace(
    from_id: str,
    to_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    return await trace_path(from_id, to_id)
