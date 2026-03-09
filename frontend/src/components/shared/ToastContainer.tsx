import { useToastStore } from "@/store/toastStore"
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react"

const ICON_MAP = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const STYLE_MAP = {
  success: {
    bg: "bg-emerald-50 border-emerald-200",
    icon: "text-emerald-500",
    title: "text-emerald-900",
    msg: "text-emerald-700",
    bar: "bg-emerald-400",
  },
  error: {
    bg: "bg-red-50 border-red-200",
    icon: "text-red-500",
    title: "text-red-900",
    msg: "text-red-700",
    bar: "bg-red-400",
  },
  warning: {
    bg: "bg-amber-50 border-amber-200",
    icon: "text-amber-500",
    title: "text-amber-900",
    msg: "text-amber-700",
    bar: "bg-amber-400",
  },
  info: {
    bg: "bg-blue-50 border-blue-200",
    icon: "text-blue-500",
    title: "text-blue-900",
    msg: "text-blue-700",
    bar: "bg-blue-400",
  },
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-[360px] pointer-events-none">
      {toasts.map((toast) => {
        const Icon = ICON_MAP[toast.type]
        const style = STYLE_MAP[toast.type]
        const duration = toast.duration ?? 4000
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-lg border shadow-lg overflow-hidden animate-in slide-in-from-right-5 fade-in duration-200 ${style.bg}`}
          >
            <div className="flex items-start gap-3 px-4 py-3">
              <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${style.icon}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${style.title}`}>{toast.title}</p>
                {toast.message && (
                  <p className={`text-xs mt-0.5 ${style.msg}`}>{toast.message}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </div>
            {/* Auto-dismiss progress bar */}
            <div className="h-[2px] w-full bg-black/5">
              <div
                className={`h-full ${style.bar}`}
                style={{
                  animation: `shrink ${duration}ms linear forwards`,
                }}
              />
            </div>
          </div>
        )
      })}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  )
}
