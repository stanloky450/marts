"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminService } from "@/lib/services/admin.service";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ViewIcon,
	// TrendingUp01Icon,
	PackageIcon,
	// Trophy01Icon,
	Alert01Icon,
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

interface MarketplaceAnalytics {
	_id: string;
	name: string;
	category: string;
	vendor: string;
	vendorSubdomain: string;
	price: number;
	stock: number;
	status: string;
	views: number;
	sales: number;
	createdAt: string;
}

interface AnalyticsData {
	products: MarketplaceAnalytics[];
	totals: {
		views: number;
		sales: number;
	};
}

export default function SuperAdminAnalyticsPage() {
	const [data, setData] = useState<AnalyticsData | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchAnalytics = async () => {
			try {
				const response = await adminService.getProductAnalytics({ limit: 50 });
				setData(response.data.data as AnalyticsData);
			} catch (error) {
				console.error("[ Failed to fetch marketplace analytics:", error);
				toast.error("Failed to load marketplace analytics");
			} finally {
				setIsLoading(false);
			}
		};

		fetchAnalytics();
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
				<div className="space-y-8">
					<div>
						<h1 className="text-4xl font-bold tracking-tight">
							Marketplace Analytics
						</h1>
						<p className="mt-2 text-lg text-muted-foreground">
							Track the most viewed and trending products across all vendors
						</p>
					</div>

					<div className="grid gap-6 md:grid-cols-3">
						<Card className="border-l-4 border-l-blue-500">
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Total Marketplace Views
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
									Across all products
								</p>
							</CardContent>
						</Card>

						<Card className="border-l-4 border-l-green-500">
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
								<p className="text-xs text-muted-foreground">
									Active in catalog
								</p>
							</CardContent>
						</Card>

						<Card className="border-l-4 border-l-purple-500">
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">
									Average Views
								</CardTitle>
								{/* <HugeiconsIcon
									icon={TrendingUp01Icon}
									className="h-4 w-4 text-muted-foreground"
								/> */}
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
							<HugeiconsIcon icon={Alert01Icon} className="h-4 w-4" />
							<AlertDescription>
								No products found in the marketplace yet.
							</AlertDescription>
						</Alert>
					) : (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									{/* <HugeiconsIcon
										icon={Trophy01Icon}
										className="h-5 w-5 text-yellow-500"
									/> */}
									Top 50 Products by Views
								</CardTitle>
								<CardDescription>
									The most viewed products across all vendors this period
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="overflow-hidden rounded-lg border">
									<Table>
										<TableHeader className="bg-muted/50">
											<TableRow className="hover:bg-muted/50">
												<TableHead className="font-semibold">Product</TableHead>
												<TableHead className="font-semibold">Vendor</TableHead>
												<TableHead className="font-semibold">
													Category
												</TableHead>
												<TableHead className="text-right font-semibold">
													Price
												</TableHead>
												<TableHead className="text-right font-semibold">
													Views
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{data?.products?.map((product, index) => (
												<TableRow
													key={product._id}
													className="hover:bg-muted/50"
												>
													<TableCell className="font-medium">
														{/* <div className="flex items-center gap-2">
															{index === 0 && (
																// <HugeiconsIcon
																// 	icon={Trophy01Icon}
																// 	className="h-4 w-4 text-yellow-500"
																// />
															)}
															{product.name}
														</div> */}
													</TableCell>
													<TableCell className="text-muted-foreground">
														{product.vendor}{" "}
														{product.vendorSubdomain &&
															`(${product.vendorSubdomain})`}
													</TableCell>
													<TableCell>
														<Badge variant="outline">{product.category}</Badge>
													</TableCell>
													<TableCell className="text-right font-medium">
														₦{product.price?.toLocaleString()}
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
