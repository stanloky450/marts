"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { referralService } from "@/lib/services/referral.service";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowLeft02Icon,
	UserGroupIcon,
	Calendar03Icon,
	PieChart01Icon,
} from "@hugeicons/core-free-icons";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

interface ReferralStats {
	code: string;
	discountPercent: number;
	usedCount: number;
	maxUses?: number | null;
	status: "active" | "inactive";
	expiresAt?: string;
	vendors: Array<{
		id: string;
		businessName: string;
		subdomain?: string;
		status: string;
		ownerEmail?: string;
		registeredAt: string;
	}>;
}

const extractErrorMessage = (error: unknown, fallback: string) => {
	if (
		error &&
		typeof error === "object" &&
		"response" in error &&
		(error as { response?: { data?: { error?: { message?: string } } } }).response
			?.data?.error?.message
	) {
		return (error as { response: { data: { error: { message: string } } } }).response
			.data.error.message;
	}
	return fallback;
};

export default function ReferralDetailPage() {
	const params = useParams();
	const router = useRouter();
	const [referral, setReferral] = useState<ReferralStats | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchReferral = async () => {
			try {
				const response = await referralService.getStats(params.id as string);
				setReferral(response.data.data);
			} catch (error: unknown) {
				console.error("Failed to fetch referral:", error);
				toast.error(extractErrorMessage(error, "Failed to load referral details"));
			} finally {
				setIsLoading(false);
			}
		};

		fetchReferral();
	}, [params.id]);

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

	if (!referral) {
		return (
			<ProtectedRoute allowedRoles={["super_admin"]}>
				<DashboardLayout>
					<div className="text-center">
						<p className="text-muted-foreground">Referral code not found</p>
						<Button onClick={() => router.back()} className="mt-4">
							Go Back
						</Button>
					</div>
				</DashboardLayout>
			</ProtectedRoute>
		);
	}

	return (
		<ProtectedRoute allowedRoles={["super_admin"]}>
			<DashboardLayout>
				<div className="space-y-6">
					<div className="flex items-center gap-4">
						<Button variant="ghost" size="icon" onClick={() => router.back()}>
							<HugeiconsIcon icon={ArrowLeft02Icon} className="h-4 w-4" />
						</Button>
						<div>
							<h1 className="text-3xl font-bold">Referral Code: {referral.code}</h1>
							<p className="text-muted-foreground">Track referral usage and statistics</p>
						</div>
					</div>

					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">Discount</CardTitle>
								<HugeiconsIcon icon={UserGroupIcon} className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">{referral.discountPercent}%</div>
								<p className="text-xs text-muted-foreground">Off registration fee</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">Total Uses</CardTitle>
								<HugeiconsIcon icon={UserGroupIcon} className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">{referral.usedCount}</div>
								<p className="text-xs text-muted-foreground">{referral.maxUses ? `of ${referral.maxUses} max` : "Unlimited"}</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">Status</CardTitle>
								<HugeiconsIcon icon={PieChart01Icon} className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">{referral.status === "active" ? "Active" : "Inactive"}</div>
								<p className="text-xs text-muted-foreground">Current status</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="text-sm font-medium">Expires</CardTitle>
								<HugeiconsIcon icon={Calendar03Icon} className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{referral.expiresAt && referral.expiresAt !== "0" ? new Date(referral.expiresAt).toLocaleDateString() : "Never"}
								</div>
								<p className="text-xs text-muted-foreground">Expiry date</p>
							</CardContent>
						</Card>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>Registered Vendors</CardTitle>
							<CardDescription>Vendors who used this referral code</CardDescription>
						</CardHeader>
						<CardContent>
							{(referral.vendors?.length ?? 0) === 0 ? (
								<p className="text-center text-muted-foreground">No vendors have used this code yet</p>
							) : (
								<div className="space-y-2">
									{referral.vendors.map((vendor, index) => (
										<div key={vendor.id} className="flex items-center justify-between rounded-lg border p-3">
											<span className="font-medium">{vendor.businessName || `Vendor #${index + 1}`}</span>
											<span className="text-sm text-muted-foreground">{vendor.ownerEmail || vendor.id}</span>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</DashboardLayout>
		</ProtectedRoute>
	);
}
