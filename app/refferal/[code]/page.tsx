"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
	referralService,
	type ReferralWithVendors,
} from "@/lib/services/referral.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

export default function ReferralDetailsPage() {
	const params = useParams();
	const code = (params.code as string) || "";

	const [data, setData] = useState<ReferralWithVendors | null>(null);
	const [loading, setLoading] = useState(true);

	// useEffect(() => {
	// 	const fetchData = async () => {
	// 		try {
	// 			const res = await fetch(
	// 				`${process.env.NEXT_PUBLIC_API_URL}/referrals/public/${code}`
	// 			);

	// 			const json = await res.json();
	// 			console.log("Referral response:", json);

	// 			// Adjust this depending on actual structure
	// 			setData(json.data?.referral || json.data || null);

	// 			// const res = await referralService.getById(code);
	// 			// setData(res.ok ? await res.json().then((r) => r.data) : null);
	// 		} catch (e) {
	// 			toast.error("Failed to load referral details");
	// 		} finally {
	// 			setLoading(false);
	// 		}
	// 	};
	// 	if (code) fetchData();
	// }, [code]);

	useEffect(() => {
		const fetchData = async () => {
			if (!code) return;

			try {
				const res = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/referrals/public/${code}`
				);
				if (!res.ok) {
					toast.error("Failed to load referral details");
					setData(null);
					return;
				}

				const json = await res.json();
				console.log("Referral API response:", json);

				// Adjust depending on backend structure
				const referral = json.data?.referral || json.data || null;

				setData(referral);
			} catch (e) {
				console.error("Error fetching referral:", e);
				toast.error("Failed to load referral details");
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [code]);

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Spinner className="h-8 w-8" />
			</div>
		);
	}

	if (!data) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center">
				<h1 className="text-2xl font-bold">Referral Not Found</h1>
				<Link href="/">
					<Button className="mt-4">Go Home</Button>
				</Link>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-3xl font-bold">Referral: {data.code}</h1>
				<Link href="/">
					<Button variant="outline">Back</Button>
				</Link>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Details</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm">
						<div>
							<span className="text-muted-foreground">Discount:</span>{" "}
							{data.discountPercent}%
						</div>
						<div>
							<span className="text-muted-foreground">Status:</span>{" "}
							<span
								className={`font-medium ${
									data.status === "active" ? "text-green-600" : "text-red-600"
								}`}
							>
								{data.status === "active" ? "Active" : "Inactive"}
							</span>
						</div>
						<div>
							<span className="text-muted-foreground">Uses:</span>{" "}
							{data.usedCount ?? 0}
							{data.maxUses ? ` / ${data.maxUses}` : ""}
						</div>
						{data.expiresAt ? (
							<div>
								<span className="text-muted-foreground">Expires:</span>{" "}
								{new Date(data.expiresAt).toLocaleString()}
							</div>
						) : null}
						{data.description ? (
							<div>
								<span className="text-muted-foreground">Description:</span>{" "}
								{data.description}
							</div>
						) : null}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Vendors who used this code</CardTitle>
					</CardHeader>
					<CardContent>
						{data.vendors?.length ? (
							<div className="space-y-3">
								{data.vendors.map((v) => (
									<div
										key={v.id}
										className="flex items-center justify-between rounded-md border p-3"
									>
										<div>
											<div className="font-medium">{v.businessName}</div>
											<div className="text-xs text-muted-foreground">
												{v.ownerEmail}
											</div>
										</div>
										{v.subdomain ? (
											<Link href={`/store/${v.subdomain}`}>
												<Button size="sm">Visit Store</Button>
											</Link>
										) : null}
									</div>
								))}
							</div>
						) : (
							<div className="text-sm text-muted-foreground">
								No vendors have used this code yet.
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
