import { useEffect, useState } from "react"
import { X, Mail, Building2, MapPin, Calendar, Briefcase, Users, TrendingUp } from "lucide-react"
import { getEmployee } from "@/api/employees"
import type { EmployeeDetail } from "@/types/employee"
import { cn } from "@/lib/utils"

interface UserProfileModalProps {
  employeeId: string
  isOpen: boolean
  onClose: () => void
}

export function UserProfileModal({ employeeId, isOpen, onClose }: UserProfileModalProps) {
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !employeeId) return
    let isActive = true
    queueMicrotask(() => {
      if (!isActive) return
      setLoading(true)
      getEmployee(employeeId)
        .then((data) => {
          if (isActive) setEmployee(data)
        })
        .catch(console.error)
        .finally(() => {
          if (isActive) setLoading(false)
        })
    })
    return () => {
      isActive = false
    }
  }, [isOpen, employeeId])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl m-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : employee ? (
          <div>
            {/* Header Section */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-8 pb-6">
              <div className="flex items-start gap-6">
                {/* Profile Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-primary text-3xl font-bold border-4 border-white shadow-lg">
                    {employee.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                </div>

                {/* Basic Info */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{employee.name}</h2>
                  <p className="text-lg text-gray-600 mb-3">{employee.designation}</p>
                  
                  <div className="flex flex-wrap gap-2">
                    <span className={cn(
                      "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium",
                      employee.is_active 
                        ? "bg-green-100 text-green-800" 
                        : "bg-gray-100 text-gray-800"
                    )}>
                      {employee.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                      {employee.level}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Section */}
            <div className="p-8 space-y-6">
              {/* Contact & Location Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {employee.email && (
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                    <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500 mb-1">Email</p>
                      <p className="text-sm font-medium text-gray-900 break-all">{employee.email}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 mb-1">Department</p>
                    <p className="text-sm font-medium text-gray-900">{employee.department}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 mb-1">Location</p>
                    <p className="text-sm font-medium text-gray-900">
                      {employee.location_city} ({employee.location_code})
                    </p>
                  </div>
                </div>

                {employee.join_date && (
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                    <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500 mb-1">Join Date</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(employee.join_date).toLocaleDateString()}
                        {employee.tenure_months && (
                          <span className="text-xs text-gray-500 ml-2">
                            ({employee.tenure_months} months)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Projects */}
              {employee.projects && employee.projects.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase className="h-5 w-5 text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-900">Active Projects</h3>
                    <span className="text-xs text-gray-500">({employee.projects.length})</span>
                  </div>
                  <div className="space-y-2">
                    {employee.projects.slice(0, 5).map((project) => (
                      <div key={project.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">{project.name}</p>
                            <p className="text-xs text-gray-500 mt-1">{project.role_in_project}</p>
                          </div>
                          <span className={cn(
                            "inline-flex items-center px-2 py-1 rounded text-xs font-medium whitespace-nowrap",
                            project.status === "ACTIVE" && "bg-green-100 text-green-800",
                            project.status === "COMPLETED" && "bg-blue-100 text-blue-800",
                            project.status === "ON_HOLD" && "bg-yellow-100 text-yellow-800"
                          )}>
                            {project.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Direct Reports */}
              {employee.direct_reports && employee.direct_reports.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-5 w-5 text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-900">Direct Reports</h3>
                    <span className="text-xs text-gray-500">({employee.direct_reports.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {employee.direct_reports.slice(0, 6).map((report) => (
                      <div key={report.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm font-medium text-gray-900">{report.name}</p>
                        <p className="text-xs text-gray-500">{report.designation}</p>
                      </div>
                    ))}
                  </div>
                  {employee.direct_reports.length > 6 && (
                    <p className="text-xs text-gray-500 mt-2">
                      +{employee.direct_reports.length - 6} more
                    </p>
                  )}
                </div>
              )}

              {/* Utilisation */}
              {employee.utilisation && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-5 w-5 text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-900">Current Utilisation</h3>
                    <span className="text-xs text-gray-500">({employee.utilisation.period})</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-primary">
                        {employee.utilisation.utilisation_percent}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Utilisation</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {employee.utilisation.billable_percent}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Billable</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-gray-900">
                        {employee.utilisation.total_hours}h
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Total Hours</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {employee.utilisation.billable_hours}h
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Billable Hours</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Skills */}
              {employee.skills && employee.skills.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {employee.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                      >
                        {skill.skill_name}
                        {skill.proficiency && (
                          <span className="ml-1 text-purple-600">• {skill.proficiency}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500">
            Unable to load profile information
          </div>
        )}
      </div>
    </div>
  )
}
