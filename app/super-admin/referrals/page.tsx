"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	referralService,
	type CreateReferralData,
} from "@/lib/services/referral.service";
import type { Referral as BaseReferral } from "@/lib/types";

import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, ViewIcon, Delete02Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";

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

export default function ReferralsPage() {
	const [referrals, setReferrals] = useState<BaseReferral[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formData, setFormData] = useState<CreateReferralData>({
		code: "",
		discountPercent: 10,
		maxUses: undefined,
		expiresAt: "",
		description: "",
	});

	const fetchReferrals = async () => {
		try {
			const response = await referralService.getAll();
			setReferrals(response.data.data);
		} catch (error) {
			console.error("[v0] Failed to fetch referrals:", error);
			toast.error("Failed to load referrals");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchReferrals();
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);

		try {
			const normalizedCode = formData.code?.trim();
			const normalizedDescription = formData.description?.trim();
			const normalizedDiscount = Number(formData.discountPercent);

			if (!Number.isFinite(normalizedDiscount) || normalizedDiscount < 0 || normalizedDiscount > 100) {
				toast.error("Discount percent must be a number between 0 and 100");
				return;
			}

			const payload: CreateReferralData = {
				discountPercent: normalizedDiscount,
				...(normalizedCode ? { code: normalizedCode } : {}),
				...(typeof formData.maxUses === "number" ? { maxUses: formData.maxUses } : {}),
				...(formData.expiresAt?.trim() ? { expiresAt: formData.expiresAt.trim() } : {}),
				...(normalizedDescription ? { description: normalizedDescription } : {}),
			};

			await referralService.create(payload);
			toast.success("Referral code created successfully");
			setIsDialogOpen(false);
			setFormData({
				code: "",
				discountPercent: 10,
				maxUses: undefined,
				expiresAt: "",
				description: "",
			});
			fetchReferrals();
		} catch (error: unknown) {
			console.error(error);
			toast.error(extractErrorMessage(error, "Failed to create referral code"));
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Are you sure you want to delete this referral code?")) return;

		try {
			await referralService.delete(id);
			toast.success("Referral code deleted successfully");
			fetchReferrals();
		} catch (error) {
			console.error("[v0] Failed to delete referral:", error);
			toast.error("Failed to delete referral code");
		}
	};

	const toggleActive = async (code: string, currentStatus: string) => {
		try {
			const newStatus = currentStatus === "active" ? "inactive" : "active";
			await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/referrals/${code}/status`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
					},
					body: JSON.stringify({ status: newStatus }),
				}
			);
			toast.success(
				`Referral code ${newStatus === "active" ? "activated" : "deactivated"}`
			);
			fetchReferrals();
		} catch (error) {
			console.error("[v0] Failed to update referral:", error);
			toast.error("Failed to update referral code");
		}
	};

	return (
		<ProtectedRoute allowedRoles={["super_admin"]}>
			<DashboardLayout>
				<div className="space-y-6">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-3xl font-bold">Referral Codes</h1>
							<p className="text-muted-foreground">
								Manage referral codes and track usage
							</p>
						</div>
						<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
							<DialogTrigger asChild>
								<Button>
									<HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
									Create Referral Code
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Create New Referral Code</DialogTitle>
									<DialogDescription>
										Generate a new referral code with discount
									</DialogDescription>
								</DialogHeader>
								<form onSubmit={handleSubmit} className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="code">Referral Code </Label>
										<Input
											id="code"
											value={formData.code}
											onChange={(e) =>
												setFormData({ ...formData, code: e.target.value })
											}
											placeholder="Leave empty to auto-generate"
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="discountPercent">
											Discount Percentage
										</Label>
										<Input
											id="discountPercent"
											type="number"
											min="0"
											max="100"
											value={formData.discountPercent}
											onChange={(e) =>
												setFormData({
													...formData,
													discountPercent: Number(e.target.value),
												})
											}
											required
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="maxUses">Max Uses (Optional)</Label>
										<Input
											id="maxUses"
											type="number"
											min="1"
											value={formData.maxUses || ""}
											onChange={(e) =>
												setFormData({
													...formData,
													maxUses: e.target.value
														? Number(e.target.value)
														: undefined,
												})
											}
											placeholder="Unlimited"
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="expiresAt">Expiry Date (Optional)</Label>
										<Input
											id="expiresAt"
											type="date"
											value={formData.expiresAt}
											onChange={(e) =>
												setFormData({ ...formData, expiresAt: e.target.value })
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="description">Description (Optional)</Label>
										<Input
											id="description"
											value={formData.description}
											onChange={(e) =>
												setFormData({
													...formData,
													description: e.target.value,
												})
											}
										/>
									</div>
									<Button
										type="submit"
										className="w-full"
										disabled={isSubmitting}
									>
										{isSubmitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
										Create Referral Code
									</Button>
								</form>
							</DialogContent>
						</Dialog>
					</div>

					{isLoading ? (
						<div className="flex justify-center py-8">
							<Spinner className="h-8 w-8" />
						</div>
					) : (
						<div className="rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Code</TableHead>
										<TableHead>Discount</TableHead>
										<TableHead>Usage</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Expires</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{referrals.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="text-center text-muted-foreground"
											>
												No referral codes found
											</TableCell>
										</TableRow>
									) : (
										referrals.map((referral) => (
											<TableRow key={referral._id}>
												<TableCell className="font-mono font-medium">
													{referral.code}
												</TableCell>
												<TableCell>{referral.discountPercent}%</TableCell>
												<TableCell>
													{referral.currentUses} / {referral.maxUses || "∞"}
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-2">
														<Switch
															checked={(referral.status ?? (referral.isActive ? "active" : "inactive")) === "active"}
															onCheckedChange={() =>
																toggleActive(referral.code, referral.status ?? (referral.isActive ? "active" : "inactive"))
															}
														/>
														<span className="text-sm">
															{(referral.status ?? (referral.isActive ? "active" : "inactive")) === "active"
																? "Active"
																: "Inactive"}
														</span>
													</div>
												</TableCell>
												<TableCell>
													{referral.expiresAt && referral.expiresAt !== "0" ? new Date(referral.expiresAt).toLocaleDateString() : "Never"}
												</TableCell>
												<TableCell className="text-right">
													<div className="flex justify-end gap-2">
														<Link
															href={`/super-admin/referrals/${referral._id}`}
														>
															<Button variant="ghost" size="icon">
																<HugeiconsIcon icon={ViewIcon} className="h-4 w-4" />
															</Button>
														</Link>
														<Button
															variant="ghost"
															size="icon"
															onClick={() => handleDelete(referral._id)}
														>
															<HugeiconsIcon icon={Delete02Icon} className="h-4 w-4 text-destructive" />
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>
					)}
				</div>
			</DashboardLayout>
		</ProtectedRoute>
	);
}

