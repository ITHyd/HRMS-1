import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useAuthStore } from "@/store/authStore"
import { login } from "@/api/auth"
import { getMode, switchMode } from "@/api/admin"
import { Building2, Eye, EyeOff, RefreshCw } from "lucide-react"

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
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Branch Command Center</CardTitle>
          <CardDescription>Sign in to access your branch dashboard</CardDescription>

          {/* Mode Toggle */}
          <div className="flex items-center justify-center gap-1 mt-3 p-1 bg-muted rounded-lg">
            <button
              type="button"
              disabled={switching}
              onClick={() => !isDemo && handleSwitchMode("demo")}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                isDemo
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-muted-foreground hover:text-foreground cursor-pointer"
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
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-muted-foreground hover:text-foreground cursor-pointer"
              } ${switching ? "opacity-50" : ""}`}
            >
              Live
            </button>
          </div>
          {switching && (
            <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Switching to {isDemo ? "live" : "demo"} mode...
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading || switching}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {/* Quick-fill accounts — changes based on mode */}
          {isDemo && (
            <div className="mt-6 border-t pt-4">
              <p className="text-xs text-muted-foreground text-center mb-2">Demo Accounts</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => { setEmail(account.email); setPassword("demo123") }}
                    className="rounded border p-2 text-left hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <p className="font-medium">{account.label}</p>
                    <p>{account.email}</p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">Password: demo123</p>
            </div>
          )}

          {isLive && (
            <div className="mt-6 border-t pt-4">
              <p className="text-xs text-muted-foreground text-center mb-2">Live Accounts</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                {LIVE_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => { setEmail(account.email); setPassword("password123") }}
                    className="rounded border p-2 text-left hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <p className="font-medium">{account.label}</p>
                    <p>{account.email}</p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">Password: password123</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
