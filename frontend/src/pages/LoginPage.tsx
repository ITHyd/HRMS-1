import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Input } from "@/components/ui/input"
import { useAuthStore } from "@/store/authStore"
import { login } from "@/api/auth"
import { getMode, switchMode } from "@/api/admin"
import { Eye, EyeOff, RefreshCw } from "lucide-react"

const DEMO_ACCOUNTS = [
  { label: "HYD Branch", email: "vikram.patel@company.com" },
  { label: "BLR Branch", email: "kavitha.rao@company.com" },
  { label: "LON Branch", email: "james.mitchell@company.com" },
  { label: "SYD Branch", email: "michael.torres@company.com" },
]

const LIVE_ACCOUNTS = [
  { label: "HYD Branch", email: "vamsi.krishna@nxzen.com" },
  { label: "BLR Branch", email: "ganapathy.thimmaiah@nxzen.com" },
]

/** NxZen geometric background pattern — tiled chevron/N shapes */
function NxZenPattern() {
  return (
    <svg
      className="absolute right-0 top-0 h-full w-[55%] pointer-events-none select-none"
      viewBox="0 0 560 800"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern id="nxzen-mark" x="0" y="0" width="130" height="130" patternUnits="userSpaceOnUse">
          {/* NxZen-style angular N mark — left stroke */}
          <polyline
            points="18,108 18,22 62,108 62,22"
            stroke="#1e4d1e"
            strokeWidth="9"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* NxZen-style angular N mark — right stroke (offset) */}
          <polyline
            points="68,108 68,22 112,108 112,22"
            stroke="#1e4d1e"
            strokeWidth="9"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#nxzen-mark)" opacity="0.7" />
    </svg>
  )
}

export function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<"demo" | "live" | "empty">("demo")
  const [switching, setSwitching] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  useEffect(() => {
    getMode()
      .then((res) => setMode(res.mode as "demo" | "live" | "empty"))
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await login({ email, password })
      setAuth(res.access_token, {
        employee_id: res.employee_id,
        branch_location_id: res.branch_location_id,
        branch_code: res.branch_code,
        name: res.name,
        role: res.role || "branch_head",
      })
      navigate("/")
    } catch {
      setError("Invalid email or password")
    } finally {
      setLoading(false)
    }
  }

  const handleSwitchMode = async (target: "demo" | "live") => {
    setSwitching(true)
    setError("")
    setEmail("")
    setPassword("")
    try {
      const res = await switchMode(target)
      setMode(res.mode as "demo" | "live")
    } catch {
      setError("Failed to switch mode. Is the backend running?")
    } finally {
      setSwitching(false)
    }
  }

  const isDemo = mode === "demo"
  const isLive = mode === "live"

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
      {/* Geometric NxZen background pattern — right side */}
      <NxZenPattern />

      {/* Subtle left gradient to fade the pattern */}
      <div className="absolute inset-0 bg-linear-to-r from-black via-black/95 to-transparent pointer-events-none" />

      {/* Form — floated center-left */}
      <div className="relative z-10 w-full max-w-sm px-6 py-10">
        {/* Logo */}
        <div className="mb-8 text-center">
          <img
            src="/nxzen-logo.jpg"
            alt="NxZen"
            className="h-11 w-11 mx-auto rounded-lg object-cover mb-3 shadow-lg shadow-[#8DE971]/10"
          />
          <p className="text-white/40 text-[11px] tracking-[0.25em] font-medium">nxzen</p>
        </div>

        <h1 className="text-white text-[1.6rem] font-bold text-center mb-7 leading-tight">
          Sign in to Branch Command
        </h1>

        {/* Mode Toggle */}
        <div className="flex items-center gap-1 mb-6 p-1 bg-white/5 rounded-lg border border-white/8">
          <button
            type="button"
            disabled={switching}
            onClick={() => !isDemo && handleSwitchMode("demo")}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              isDemo
                ? "bg-[#AD96DC]/20 text-[#AD96DC]"
                : "text-white/35 hover:text-white/70 cursor-pointer"
            } ${switching ? "opacity-50" : ""}`}
          >
            Demo
          </button>
          <button
            type="button"
            disabled={switching}
            onClick={() => !isLive && handleSwitchMode("live")}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              isLive
                ? "bg-[#8DE971]/20 text-[#8DE971]"
                : "text-white/35 hover:text-white/70 cursor-pointer"
            } ${switching ? "opacity-50" : ""}`}
          >
            Live
          </button>
        </div>

        {switching && (
          <div className="flex items-center justify-center gap-2 mb-4 text-xs text-white/40">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Switching mode…
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-white/60 text-sm font-medium mb-1.5 block">Email address</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@nxzen.com"
              required
              className="h-11 rounded-lg border-white/10 bg-[#111827] text-white placeholder:text-white/25 focus-visible:ring-[#8DE971] focus-visible:border-[#8DE971]/50"
            />
          </div>
          <div>
            <label className="text-white/60 text-sm font-medium mb-1.5 block">Password</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="h-11 pr-10 rounded-lg border-white/10 bg-[#111827] text-white placeholder:text-white/25 focus-visible:ring-[#8DE971] focus-visible:border-[#8DE971]/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || switching}
            className="w-full h-11 rounded-full bg-[#4caf50] text-white font-semibold text-sm hover:bg-[#43a047] transition-colors shadow-lg shadow-[#4caf50]/20 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Quick-fill accounts */}
        {isDemo && (
          <div className="mt-6 border-t border-white/8 pt-5">
            <p className="text-xs text-white/30 text-center mb-3">Quick fill — Demo accounts</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-white/50">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => { setEmail(account.email); setPassword("demo123") }}
                  className="rounded-lg border border-white/8 bg-white/3 p-2.5 text-left hover:bg-white/7 hover:text-[#AD96DC] transition-colors cursor-pointer"
                >
                  <p className="font-medium text-white/70">{account.label}</p>
                  <p className="truncate mt-0.5">{account.email}</p>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-white/25 text-center mt-3">Password: demo123</p>
          </div>
        )}

        {isLive && (
          <div className="mt-6 border-t border-white/8 pt-5">
            <p className="text-xs text-white/30 text-center mb-3">Quick fill — Live accounts</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-white/50">
              {LIVE_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => { setEmail(account.email); setPassword("password123") }}
                  className="rounded-lg border border-white/8 bg-white/3 p-2.5 text-left hover:bg-white/7 hover:text-[#8DE971] transition-colors cursor-pointer"
                >
                  <p className="font-medium text-white/70">{account.label}</p>
                  <p className="truncate mt-0.5">{account.email}</p>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-white/25 text-center mt-3">Password: password123</p>
          </div>
        )}
      </div>
    </div>
  )
}
