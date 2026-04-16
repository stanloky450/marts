"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { vendorService } from "@/lib/services/vendor.service";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ViewIcon,
	PieChart01Icon,
	PackageIcon,
	AlertCircleIcon,
} from "@hugeicons/core-free-icons";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProductAnalytics {
	_id: string;
	name: string;
	category: string;
	price: number;
	stock: number;
	status: string;
	views: number;
	sales: number;
	createdAt: string;
}

interface AnalyticsData {
	products: ProductAnalytics[];
	totals: {
		views: number;
		sales: number;
	};
}

export default function VendorAnalyticsPage() {
	const [data, setData] = useState<AnalyticsData | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchAnalytics = async () => {
			try {
				const response = await vendorService.getProductAnalytics();
				setData(response.data.data as AnalyticsData);
			} catch (error) {
				console.error("[ Failed to fetch analytics:", error);
				toast.error("Failed to load product analytics");
			} finally {
				setIsLoading(false);
			}
		};

		fetchAnalytics();
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
				<div className="space-y-8">
					<div>
						<h1 className="text-4xl font-bold tracking-tight">
							Product Analytics
						</h1>
						<p className="mt-2 text-lg text-muted-foreground">
							Monitor views and performance across your store
						</p>
					</div>

					<div className="grid gap-6 md:grid-cols-3">
						<Card className="border-l-4 border-l-violet-500">
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Total Product Views
								</CardTitle>
								<HugeiconsIcon
									icon={ViewIcon}
									className="h-4 w-4 text-muted-foreground"
								/>
							</CardHeader>
							<CardContent>
								<div className="text-3xl font-bold">
									{data?.totals?.views?.toLocaleString() || 0}
								</div>
								<p className="text-xs text-muted-foreground">
									Total impressions
								</p>
							</CardContent>
						</Card>

						<Card className="border-l-4 border-l-cyan-500">
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Total Products
								</CardTitle>
								<HugeiconsIcon
									icon={PackageIcon}
									className="h-4 w-4 text-muted-foreground"
								/>
							</CardHeader>
							<CardContent>
								<div className="text-3xl font-bold">
									{data?.products?.length || 0}
								</div>
								<p className="text-xs text-muted-foreground">Active catalog</p>
							</CardContent>
						</Card>

						<Card className="border-l-4 border-l-emerald-500">
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Avg Views/Product
								</CardTitle>
								<HugeiconsIcon
									icon={PieChart01Icon}
									className="h-4 w-4 text-muted-foreground"
								/>
							</CardHeader>
							<CardContent>
								<div className="text-3xl font-bold">
									{data?.products?.length
										? Math.round(data.totals.views / data.products.length)
										: 0}
								</div>
								<p className="text-xs text-muted-foreground">
									Per product average
								</p>
							</CardContent>
						</Card>
					</div>

					{data?.products?.length === 0 ? (
						<Alert>
							<HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4" />
							<AlertDescription>
								You haven't created any products yet. Start by adding your first
								product to see analytics.
							</AlertDescription>
						</Alert>
					) : (
						<Card>
							<CardHeader>
								<CardTitle>Your Top Products</CardTitle>
								<CardDescription>
									Your most viewed products sorted by engagement
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="overflow-hidden rounded-lg border">
									<Table>
										<TableHeader className="bg-muted/50">
											<TableRow className="hover:bg-muted/50">
												<TableHead className="font-semibold">
													Product Name
												</TableHead>
												<TableHead className="font-semibold">
													Category
												</TableHead>
												<TableHead className="font-semibold">Status</TableHead>
												<TableHead className="text-right font-semibold">
													Price
												</TableHead>
												<TableHead className="text-right font-semibold">
													Stock
												</TableHead>
												<TableHead className="text-right font-semibold">
													Views
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{data?.products?.map((product) => (
												<TableRow
													key={product._id}
													className="hover:bg-muted/50"
												>
													<TableCell className="font-medium">
														{product.name}
													</TableCell>
													<TableCell>
														<Badge variant="outline">{product.category}</Badge>
													</TableCell>
													<TableCell>
														<Badge
															variant={
																product.status === "approved"
																	? "default"
																	: "secondary"
															}
														>
															{product.status}
														</Badge>
													</TableCell>
													<TableCell className="text-right font-medium">
														₦{product.price?.toLocaleString()}
													</TableCell>
													<TableCell className="text-right">
														<Badge variant="outline">{product.stock}</Badge>
													</TableCell>
													<TableCell className="text-right">
														<Badge variant="secondary" className="font-bold">
															{product.views?.toLocaleString()}
														</Badge>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			</DashboardLayout>
		</ProtectedRoute>
	);
}
