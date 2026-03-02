from typing import Optional

from pydantic import BaseModel


class OrgTreeNode(BaseModel):
    id: str
    name: str
    designation: str
    department: str
    department_id: str
    level: str
    location_id: str
    location_code: str
    location_city: str
    photo_url: Optional[str] = None
    is_active: bool = True
    children: list["OrgTreeNode"] = []
    is_branch_head: bool = False
    is_own_branch: bool = False
    collapsed_child_count: int = 0


class SecondaryEdge(BaseModel):
    from_id: str  # employee_id
    to_id: str  # manager_id
    type: str  # "FUNCTIONAL" | "PROJECT"


class OrgTreeResponse(BaseModel):
    nodes: list[OrgTreeNode]
    secondary_edges: list[SecondaryEdge]


class ReportingChainResponse(BaseModel):
    chain: list[dict]  # ordered from employee to CEO


class TracePathResponse(BaseModel):
    path: list[str]  # list of employee IDs forming the path
    path_details: list[dict]  # employee details for each node in path
