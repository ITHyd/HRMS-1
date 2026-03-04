from collections import defaultdict

from app.models.department import Department
from app.models.employee import Employee
from app.models.location import Location
from app.models.reporting_relationship import ReportingRelationship


async def _build_lookup_maps():
    locations = await Location.find_all().to_list()
    departments = await Department.find_all().to_list()
    loc_map = {str(l.id): l for l in locations}
    dept_map = {str(d.id): d for d in departments}
    return loc_map, dept_map


def _employee_to_dict(emp, loc_map, dept_map, branch_location_id=None, branch_head_id=None):
    loc = loc_map.get(emp.location_id)
    dept = dept_map.get(emp.department_id)
    parent_dept = dept_map.get(dept.parent_id) if dept and dept.parent_id else None
    return {
        "id": str(emp.id),
        "name": emp.name,
        "designation": emp.designation,
        "department": dept.name if dept else "Unknown",
        "department_id": emp.department_id,
        "parent_department_id": dept.parent_id if dept and dept.parent_id else emp.department_id,
        "parent_department_name": parent_dept.name if parent_dept else (dept.name if dept else "Unknown"),
        "level": emp.level,
        "location_id": emp.location_id,
        "location_code": loc.code if loc else "UNK",
        "location_city": loc.city if loc else "Unknown",
        "photo_url": emp.photo_url,
        "is_active": emp.is_active,
        "is_branch_head": str(emp.id) == branch_head_id if branch_head_id else False,
        "is_own_branch": emp.location_id == branch_location_id if branch_location_id else False,
        "children": [],
        "collapsed_child_count": 0,
    }


async def build_full_org_tree(branch_location_id: str = None, branch_head_id: str = None):
    employees = await Employee.find(Employee.is_active == True).to_list()
    primary_rels = await ReportingRelationship.find(
        ReportingRelationship.type == "PRIMARY"
    ).to_list()
    secondary_rels = await ReportingRelationship.find(
        ReportingRelationship.type != "PRIMARY"
    ).to_list()

    loc_map, dept_map = await _build_lookup_maps()

    # Build adjacency: manager_id -> [employee_ids]
    children_map = defaultdict(list)
    parent_map = {}
    for rel in primary_rels:
        children_map[rel.manager_id].append(rel.employee_id)
        parent_map[rel.employee_id] = rel.manager_id

    # Find roots: employees with no primary manager
    all_emp_ids = {str(e.id) for e in employees}
    managed_ids = {r.employee_id for r in primary_rels}
    root_ids = all_emp_ids - managed_ids

    emp_map = {str(e.id): e for e in employees}

    def build_subtree(node_id, visited=None):
        if visited is None:
            visited = set()
        if node_id in visited:
            return None
        visited.add(node_id)
        emp = emp_map.get(node_id)
        if not emp:
            return None
        node = _employee_to_dict(emp, loc_map, dept_map, branch_location_id, branch_head_id)
        child_ids = children_map.get(node_id, [])
        for child_id in child_ids:
            child_node = build_subtree(child_id, visited)
            if child_node:
                node["children"].append(child_node)
        return node

    tree_nodes = []
    for root_id in root_ids:
        tree = build_subtree(root_id)
        if tree:
            tree_nodes.append(tree)

    secondary_edges = [
        {
            "from_id": r.employee_id,
            "to_id": r.manager_id,
            "type": r.type,
        }
        for r in secondary_rels
    ]

    return {"nodes": tree_nodes, "secondary_edges": secondary_edges}


async def get_branch_subtree(location_id: str, branch_head_id: str = None):
    employees = await Employee.find(
        Employee.location_id == location_id,
        Employee.is_active == True,
    ).to_list()
    primary_rels = await ReportingRelationship.find(
        ReportingRelationship.type == "PRIMARY"
    ).to_list()

    loc_map, dept_map = await _build_lookup_maps()

    branch_emp_ids = {str(e.id) for e in employees}
    emp_map = {str(e.id): e for e in employees}

    children_map = defaultdict(list)
    for rel in primary_rels:
        if rel.employee_id in branch_emp_ids and rel.manager_id in branch_emp_ids:
            children_map[rel.manager_id].append(rel.employee_id)

    managed_in_branch = {
        r.employee_id
        for r in primary_rels
        if r.employee_id in branch_emp_ids and r.manager_id in branch_emp_ids
    }
    root_ids = branch_emp_ids - managed_in_branch

    def build_subtree(node_id, visited=None):
        if visited is None:
            visited = set()
        if node_id in visited:
            return None
        visited.add(node_id)
        emp = emp_map.get(node_id)
        if not emp:
            return None
        node = _employee_to_dict(emp, loc_map, dept_map, location_id, branch_head_id)
        for child_id in children_map.get(node_id, []):
            child_node = build_subtree(child_id, visited)
            if child_node:
                node["children"].append(child_node)
        return node

    tree_nodes = []
    for root_id in root_ids:
        tree = build_subtree(root_id)
        if tree:
            tree_nodes.append(tree)

    return {"nodes": tree_nodes, "secondary_edges": []}


async def get_reporting_chain(employee_id: str):
    """Walk upward from employee to CEO via PRIMARY relationships."""
    all_rels = await ReportingRelationship.find(
        ReportingRelationship.type == "PRIMARY"
    ).to_list()

    child_to_parent = {r.employee_id: r.manager_id for r in all_rels}

    loc_map, dept_map = await _build_lookup_maps()

    chain = []
    current_id = employee_id
    visited = set()

    while current_id and current_id not in visited:
        visited.add(current_id)
        emp = await Employee.get(current_id)
        if emp:
            chain.append(_employee_to_dict(emp, loc_map, dept_map))
        parent_id = child_to_parent.get(current_id)
        current_id = parent_id

    return chain


async def trace_path(from_id: str, to_id: str):
    """Find path between any two employees via their LCA in the primary reporting tree."""
    all_rels = await ReportingRelationship.find(
        ReportingRelationship.type == "PRIMARY"
    ).to_list()

    child_to_parent = {r.employee_id: r.manager_id for r in all_rels}

    def get_chain_to_root(emp_id):
        chain = []
        current = emp_id
        visited = set()
        while current and current not in visited:
            visited.add(current)
            chain.append(current)
            current = child_to_parent.get(current)
        return chain

    chain_a = get_chain_to_root(from_id)
    chain_b = get_chain_to_root(to_id)

    set_a = set(chain_a)
    lca = None
    for node in chain_b:
        if node in set_a:
            lca = node
            break

    if lca is None:
        return []

    # Build path: from -> ... -> LCA -> ... -> to
    path_up = []
    for node in chain_a:
        path_up.append(node)
        if node == lca:
            break

    path_down = []
    for node in chain_b:
        if node == lca:
            break
        path_down.append(node)

    path_down.reverse()
    full_path = path_up + path_down

    loc_map, dept_map = await _build_lookup_maps()
    path_details = []
    for eid in full_path:
        emp = await Employee.get(eid)
        if emp:
            path_details.append(_employee_to_dict(emp, loc_map, dept_map))

    return {"path": full_path, "path_details": path_details}
