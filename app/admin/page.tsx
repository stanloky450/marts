"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { apiClient } from "@/lib/api-client"
import type { ApiResponse } from "@/lib/types"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserGroupIcon, PackageIcon, CheckmarkCircle02Icon, Clock01Icon } from "@hugeicons/core-free-icons"
import { Spinner } from "@/components/ui/spinner"

interface AdminDashboardStats {
  assignedVendors: number
  totalProducts: number
  pendingProducts: number
  approvedProducts: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await apiClient.get<ApiResponse<AdminDashboardStats>>("/admins/me/stats")
        setStats(response.data.data)
      } catch (error) {
        console.error("[v0] Failed to fetch stats:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (isLoading) {
    return (
      <ProtectedRoute allowedRoles={["admin"]}>
        <DashboardLayout userRole="admin">
          <div className="flex h-full items-center justify-center">
            <Spinner className="h-8 w-8" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout userRole="admin">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage your assigned vendors and products</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Assigned Vendors</CardTitle>
                <HugeiconsIcon icon={UserGroupIcon} className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.assignedVendors || 0}</div>
                <p className="text-xs text-muted-foreground">Vendors under your management</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                <HugeiconsIcon icon={PackageIcon} className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalProducts || 0}</div>
                <p className="text-xs text-muted-foreground">From assigned vendors</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                <HugeiconsIcon icon={Clock01Icon} className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.pendingProducts || 0}</div>
                <p className="text-xs text-muted-foreground">Awaiting approval</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Approved</CardTitle>
                <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.approvedProducts || 0}</div>
                <p className="text-xs text-muted-foreground">Products approved</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
