"use client";

import { useEffect, useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";
import type { ApiResponse, Vendor } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

export function RecentVendorsTable() {
	const [vendors, setVendors] = useState<Vendor[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchVendors = async () => {
			try {
				const response = await apiClient.get<ApiResponse<Vendor[]>>("/vendors", {
					params: { limit: 5 },
				});
				setVendors(response.data.data.slice(0, 5));
			} catch (error) {
				console.error("Failed to fetch recent vendors:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchVendors();
	}, []);

	return (
		<Card className="col-span-2">
			<CardHeader>
				<CardTitle>Recent Vendors</CardTitle>
				<CardDescription>Latest vendors to join the platform</CardDescription>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="flex justify-center py-4">
						<Spinner className="h-6 w-6" />
					</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Business Name</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="text-right">Joined</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{vendors.length === 0 ? (
								<TableRow>
									<TableCell colSpan={3} className="text-center text-muted-foreground">
										No recent vendors
									</TableCell>
								</TableRow>
							) : (
								vendors.map((vendor) => (
									<TableRow key={vendor._id}>
										<TableCell className="font-medium">
											{vendor.businessName}
										</TableCell>
										<TableCell>
											<span
												className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${
													vendor.status === "active"
														? "bg-green-100 text-green-800"
														: "bg-yellow-100 text-yellow-800"
												}`}
											>
												{vendor.status === "active" ? "Active" : "Inactive"}
											</span>
										</TableCell>
										<TableCell className="text-right text-xs text-muted-foreground">
											{formatDistanceToNow(new Date(vendor.createdAt || Date.now()), {
												addSuffix: true,
											})}
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
