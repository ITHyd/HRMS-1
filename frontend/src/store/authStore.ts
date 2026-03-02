import { create } from "zustand"

interface AuthUser {
  employee_id: string
  branch_location_id: string
  branch_code: string
  name: string
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  setAuth: (token: string, user: AuthUser) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem("access_token"),
  user: JSON.parse(localStorage.getItem("user") || "null"),

  setAuth: (token, user) => {
    localStorage.setItem("access_token", token)
    localStorage.setItem("user", JSON.stringify(user))
    set({ token, user })
  },

  logout: () => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("user")
    set({ token: null, user: null })
  },

  isAuthenticated: () => !!get().token,
}))
