"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { ShoppingBag01Icon } from "@hugeicons/core-free-icons"

export default function VendorOrdersPage() {
  return (
    <ProtectedRoute allowedRoles={["vendor"]}>
      <DashboardLayout userRole="vendor">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Orders</h1>
            <p className="text-muted-foreground">Manage customer orders</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={ShoppingBag01Icon} className="h-5 w-5" />
                <CardTitle>Coming Soon</CardTitle>
              </div>
              <CardDescription>Order management features will be available soon</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This section will allow you to view and manage customer orders, track shipments, and handle order
                fulfillment.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
