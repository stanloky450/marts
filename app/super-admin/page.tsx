"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	adminService,
	type DashboardStats,
} from "@/lib/services/admin.service";
import { HugeiconsIcon } from "@hugeicons/react";
import { 
  UserGroupIcon, 
  PackageIcon, 
  Store01Icon, 
  Money01Icon, 
  ChartBarLineIcon, 
  ViewIcon 
} from "@hugeicons/core-free-icons";
import { Spinner } from "@/components/ui/spinner";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { TopProductsTable } from "@/components/dashboard/TopProductsTable";
import { RecentVendorsTable } from "@/components/dashboard/RecentVendorsTable";

export default function SuperAdminDashboard() {
	const [stats, setStats] = useState<DashboardStats | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchStats = async () => {
			try {
				const response = await adminService.getStats();
				setStats(response.data.data);
			} catch (error) {
				console.error(" Failed to fetch stats:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchStats();
	}, []);

	if (isLoading) {
		return (
			<ProtectedRoute allowedRoles={["super_admin"]}>
				<DashboardLayout>
					<div className="flex h-full items-center justify-center">
						<Spinner className="h-8 w-8" />
					</div>
				</DashboardLayout>
			</ProtectedRoute>
		);
	}

	return (
		<ProtectedRoute allowedRoles={["super_admin"]}>
			<DashboardLayout>
				<div className="space-y-6">
					<div>
						<h1 className="text-3xl font-bold">Dashboard</h1>
						<p className="text-muted-foreground">
							Welcome to your super admin dashboard
						</p>
					</div>

					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Total Views
								</CardTitle>
								<HugeiconsIcon icon={ViewIcon} className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{stats?.totals.views?.toLocaleString() || 0}
								</div>
								<p className="text-xs text-muted-foreground">
									Across all products
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Total Products
								</CardTitle>
								<HugeiconsIcon icon={PackageIcon} className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{stats?.totals.products || 0}
								</div>
								<p className="text-xs text-muted-foreground">
									+{stats?.recent.products || 0} this month
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Total Vendors
								</CardTitle>
								<HugeiconsIcon icon={Store01Icon} className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{stats?.totals.vendors || 0}
								</div>
								<p className="text-xs text-muted-foreground">
									+{stats?.recent.vendors || 0} this month
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Total Admins
								</CardTitle>
								<HugeiconsIcon icon={UserGroupIcon} className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{stats?.totals.admins || 0}
								</div>
								<p className="text-xs text-muted-foreground">
									Platform administrators
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Total Revenue
								</CardTitle>
								<HugeiconsIcon icon={Money01Icon} className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									₦{stats?.totals.revenue?.toLocaleString() || 0}
								</div>
								<p className="text-xs text-muted-foreground">
									+₦{stats?.recent.revenue?.toLocaleString() || 0} this month
								</p>
							</CardContent>
						</Card>
					</div>

					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
						<RevenueChart data={stats?.chartData || []} />
					</div>

					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
						<TopProductsTable />
						<RecentVendorsTable />
					</div>
				</div>
			</DashboardLayout>
		</ProtectedRoute>
	);
}
