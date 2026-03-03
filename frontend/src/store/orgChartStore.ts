import { create } from "zustand"
import type { OrgTreeResponse } from "@/types/org"

interface OrgChartState {
  treeData: OrgTreeResponse | null
  expandedNodeIds: Set<string>
  expandedDeptGroups: Set<string>
  selectedEmployeeId: string | null
  focusedEmployeeId: string | null
  highlightedPath: string[]
  isDrawerOpen: boolean
  traceMode: { active: boolean; fromId?: string; toId?: string }
  isLoading: boolean

  setTreeData: (data: OrgTreeResponse) => void
  toggleNodeExpand: (nodeId: string) => void
  expandNode: (nodeId: string) => void
  collapseNode: (nodeId: string) => void
  toggleDeptGroupExpand: (groupId: string) => void
  selectEmployee: (id: string) => void
  closeDrawer: () => void
  focusOnEmployee: (id: string) => void
  exitFocus: () => void
  setHighlightedPath: (path: string[]) => void
  clearHighlight: () => void
  startTrace: (fromId: string) => void
  completeTrace: (toId: string) => void
  clearTrace: () => void
  setLoading: (loading: boolean) => void
  expandBranch: (nodeIds: string[]) => void
}

export const useOrgChartStore = create<OrgChartState>((set, get) => ({
  treeData: null,
  expandedNodeIds: new Set<string>(),
  expandedDeptGroups: new Set<string>(),
  selectedEmployeeId: null,
  focusedEmployeeId: null,
  highlightedPath: [],
  isDrawerOpen: false,
  traceMode: { active: false },
  isLoading: false,

  setTreeData: (data) => set({ treeData: data }),

  toggleNodeExpand: (nodeId) => {
    const expanded = new Set(get().expandedNodeIds)
    if (expanded.has(nodeId)) {
      expanded.delete(nodeId)
    } else {
      expanded.add(nodeId)
    }
    set({ expandedNodeIds: expanded })
  },

  expandNode: (nodeId) => {
    const expanded = new Set(get().expandedNodeIds)
    expanded.add(nodeId)
    set({ expandedNodeIds: expanded })
  },

  collapseNode: (nodeId) => {
    const expanded = new Set(get().expandedNodeIds)
    expanded.delete(nodeId)
    set({ expandedNodeIds: expanded })
  },

  toggleDeptGroupExpand: (groupId) => {
    const expanded = new Set(get().expandedDeptGroups)
    if (expanded.has(groupId)) {
      expanded.delete(groupId)
    } else {
      expanded.add(groupId)
    }
    set({ expandedDeptGroups: expanded })
  },

  selectEmployee: (id) => set({ selectedEmployeeId: id, isDrawerOpen: true }),

  closeDrawer: () => set({ isDrawerOpen: false, selectedEmployeeId: null }),

  focusOnEmployee: (id) => set({ focusedEmployeeId: id }),

  exitFocus: () => set({ focusedEmployeeId: null }),

  setHighlightedPath: (path) => set({ highlightedPath: path }),

  clearHighlight: () => set({ highlightedPath: [] }),

  startTrace: (fromId) =>
    set({ traceMode: { active: true, fromId, toId: undefined } }),

  completeTrace: (toId) => {
    const { traceMode } = get()
    set({ traceMode: { ...traceMode, toId } })
  },

  clearTrace: () =>
    set({ traceMode: { active: false }, highlightedPath: [] }),

  setLoading: (loading) => set({ isLoading: loading }),

  expandBranch: (nodeIds) => {
    const expanded = new Set(get().expandedNodeIds)
    nodeIds.forEach((id) => expanded.add(id))
    set({ expandedNodeIds: expanded })
  },
}))
