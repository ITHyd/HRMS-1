import { create } from "zustand"

export interface Toast {
  id: string
  type: "success" | "error" | "info" | "warning"
  title: string
  message?: string
  duration?: number // ms, default 4000
}

interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, "id">) => void
  removeToast: (id: string) => void
}

let counter = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${++counter}-${Date.now()}`
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }))
    // Auto-dismiss
    const duration = toast.duration ?? 4000
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }))
    }, duration)
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))
