import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useAuthStore } from "@/store/authStore"
import { login } from "@/api/auth"
import { Building2, Eye, EyeOff } from "lucide-react"

export function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Branch Command Center</CardTitle>
          <CardDescription>Sign in to access your branch dashboard</CardDescription>
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 border-t pt-4">
            <p className="text-xs text-muted-foreground text-center mb-2">Demo Accounts</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              {[
                { label: "HYD Branch", email: "vikram.patel@company.com" },
                { label: "BLR Branch", email: "kavitha.rao@company.com" },
                { label: "LON Branch", email: "james.mitchell@company.com" },
                { label: "SYD Branch", email: "michael.torres@company.com" },
              ].map((account) => (
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
        </CardContent>
      </Card>
    </div>
  )
}
