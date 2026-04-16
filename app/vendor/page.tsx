"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { vendorService } from "@/lib/services/vendor.service";
import { HugeiconsIcon } from "@hugeicons/react";
import { 
  PackageIcon, 
  CheckmarkCircle02Icon, 
  Clock01Icon, 
  Cancel01Icon,
  ViewIcon 
} from "@hugeicons/core-free-icons";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

interface ProfileStats {
	total: number;
	approved: number;
	pending: number;
	rejected: number;
}

interface DashboardStats {
	totals: {
		products: number;
		revenue: number;
		views: number;
	};
	recent: {
		products: number;
	};
}

export default function VendorDashboard() {
	const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
	const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchStats = async () => {
			try {
				const [profileRes, statsRes] = await Promise.all([
					vendorService.getProfile(),
					vendorService.getStats()
				]);
				setProfileStats(profileRes.data.data.stats);
				setDashboardStats(statsRes.data.data as unknown as DashboardStats);
			} catch (error) {
				console.error("[ Failed to fetch stats:", error);
				toast.error("Failed to load statistics");
			} finally {
				setIsLoading(false);
			}
		};

		fetchStats();
	}, []);

	if (isLoading) {
		return (
			<ProtectedRoute allowedRoles={["vendor"]}>
				<DashboardLayout userRole="vendor">
					<div className="flex h-full items-center justify-center">
						<Spinner className="h-8 w-8" />
					</div>
				</DashboardLayout>
			</ProtectedRoute>
		);
	}

	return (
		<ProtectedRoute allowedRoles={["vendor"]}>
			<DashboardLayout userRole="vendor">
				<div className="space-y-6">
					<div>
						<h1 className="text-3xl font-bold">Vendor Dashboard</h1>
						<p className="text-muted-foreground">
							Manage your products and store
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
									{dashboardStats?.totals?.views?.toLocaleString() || 0}
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
									{profileStats?.total || 0}
								</div>
								<p className="text-xs text-muted-foreground">
									All your products
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">Approved</CardTitle>
								<HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{profileStats?.approved || 0}
								</div>
								<p className="text-xs text-muted-foreground">Live on store</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Pending Review
								</CardTitle>
								<HugeiconsIcon icon={Clock01Icon} className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{profileStats?.pending || 0}
								</div>
								<p className="text-xs text-muted-foreground">
									Awaiting approval
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">Rejected</CardTitle>
								<HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{profileStats?.rejected || 0}
								</div>
								<p className="text-xs text-muted-foreground">Need revision</p>
							</CardContent>
						</Card>
					</div>
				</div>
			</DashboardLayout>
		</ProtectedRoute>
	);
}
