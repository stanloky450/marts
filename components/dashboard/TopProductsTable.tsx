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
import type { ApiResponse } from "@/lib/types";

interface ProductInsight {
	_id: string;
	title: string;
	price: number;
	vendorName?: string;
	views?: number;
}

export function TopProductsTable() {
	const [products, setProducts] = useState<ProductInsight[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchProducts = async () => {
			try {
				const response = await apiClient.get<ApiResponse<any>>(
					"/admins/products/analytics",
					{ params: { sort: "views", limit: 5 } }
				);
				// Depending on what the analytics returns, we might need to map it.
				// Assuming it returns an array of products or an object containing the array.
				const data = response.data.data;
				setProducts(Array.isArray(data) ? data.slice(0, 5) : (data?.products || []).slice(0, 5));
			} catch (error) {
				console.error("Failed to fetch top products:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchProducts();
	}, []);

	return (
		<Card className="col-span-2">
			<CardHeader>
				<CardTitle>Top Viewed Products</CardTitle>
				<CardDescription>Highest performing products recently</CardDescription>
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
								<TableHead>Product</TableHead>
								<TableHead>Price</TableHead>
								<TableHead className="text-right">Views</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{products.length === 0 ? (
								<TableRow>
									<TableCell colSpan={3} className="text-center text-muted-foreground">
										No product data available
									</TableCell>
								</TableRow>
							) : (
								products.map((product) => (
									<TableRow key={product._id}>
										<TableCell className="font-medium">
											{product.title}
										</TableCell>
										<TableCell>₦{product.price?.toLocaleString() || 0}</TableCell>
										<TableCell className="text-right font-semibold">
											{product.views?.toLocaleString() || 0}
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
