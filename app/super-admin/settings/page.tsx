"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { Settings02Icon, Location01Icon, Store01Icon } from "@hugeicons/core-free-icons"
import Link from "next/link"

export default function SettingsPage() {
  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Configure platform settings</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={Settings02Icon} className="h-5 w-5" />
                <CardTitle>Platform Settings</CardTitle>
              </div>
              <CardDescription>Manage global platform configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Settings management features will be available soon. This will include registration fees, payment
                configuration, email templates, and more.
              </p>
            </CardContent>
          </Card>

					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						<Link href="/super-admin/settings/locations">
							<Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
								<CardHeader>
									<div className="flex items-center gap-2">
										<HugeiconsIcon icon={Location01Icon} className="h-5 w-5 text-primary" />
										<CardTitle>Locations & Pricing</CardTitle>
									</div>
									<CardDescription>
										Manage regions, areas, and location-specific registration fees.
									</CardDescription>
								</CardHeader>
							</Card>
						</Link>

						<Link href="/super-admin/settings/market">
							<Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
								<CardHeader>
									<div className="flex items-center gap-2">
										<HugeiconsIcon icon={Store01Icon} className="h-5 w-5 text-primary" />
										<CardTitle>Market Page Settings</CardTitle>
									</div>
									<CardDescription>
										Manage the store banner, RSS feeds, and visual configurations for the Market.
									</CardDescription>
								</CardHeader>
							</Card>
						</Link>
					</div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
