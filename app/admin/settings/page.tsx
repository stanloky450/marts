"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { Settings01Icon } from "@hugeicons/core-free-icons"

export default function AdminSettingsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout userRole="admin">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your account settings</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={Settings01Icon} className="h-5 w-5" />
                <CardTitle>Account Settings</CardTitle>
              </div>
              <CardDescription>Update your profile and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Settings management features will be available soon. This will include profile updates, notification
                preferences, and more.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
