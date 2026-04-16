"use client";

import type React from "react";
import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { vendorService } from "@/lib/services/vendor.service";
import type { Vendor } from "@/lib/types";
import { HugeiconsIcon } from "@hugeicons/react";
import { Store01Icon, Link02Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

export default function VendorStorePage() {
	const [vendor, setVendor] = useState<Vendor | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [subdomain, setSubdomain] = useState("");
	const [debugInfo, setDebugInfo] = useState<any>(null);

	useEffect(() => {
		const fetchVendor = async () => {
			try {
				// console.log("🔄 Starting vendor fetch...");
				const response = await vendorService.getProfile();

				// console.log("📥 FULL RESPONSE:", response);
				// console.log("📥 response.data:", response.data);
				// console.log("📥 response.data.data:", response.data.data);
				// console.log(
				// 	"📥 response.data.data.vendor:",
				// 	response.data.data?.vendor
				// );

				// The actual structure is:
				// response.data.data.vendor = the vendor object
				const vendorData = (response.data as any)?.data?.vendor;

				console.log("✅ Extracted vendorData:", vendorData);
				console.log("✅ vendorData.businessName:", vendorData?.businessName);
				console.log("✅ vendorData.subdomain:", vendorData?.subdomain);

				// Store debug info
				setDebugInfo({
					fullResponse: response,
					responseData: response?.data,
					responseDataData: response?.data?.data,
					extractedVendor: vendorData,
					businessName: vendorData?.businessName,
					subdomain: vendorData?.subdomain,
					timestamp: new Date().toISOString(),
				});

				// console.log("✅ Extracted vendorData:", vendorData);
				// console.log("✅ vendorData type:", typeof vendorData);
				// console.log("✅ vendorData is null?", vendorData === null);
				// console.log("✅ vendorData is undefined?", vendorData === undefined);
				// console.log(
				// 	"✅ vendorData keys:",
				// 	vendorData ? Object.keys(vendorData) : "N/A"
				// );

				if (vendorData) {
					console.log("✅ Setting vendor state with:", vendorData);
					setVendor(vendorData);

					if (vendorData.subdomain) {
						console.log("✅ Setting subdomain:", vendorData.subdomain);
						setSubdomain(vendorData.subdomain);
					}
				} else {
					console.error("❌ vendorData is null or undefined!");
					toast.error("No vendor data received from server");
				}
			} catch (error) {
				console.error("❌ Error fetching vendor:", error);
				setDebugInfo({
					error: error,
					errorMessage: error instanceof Error ? error.message : String(error),
					timestamp: new Date().toISOString(),
				});
				toast.error("Failed to load store settings");
			} finally {
				setIsLoading(false);
				console.log("✅ Loading complete");
			}
		};

		fetchVendor();
	}, []);

	// Log vendor state changes
	useEffect(() => {
		console.log("🔔 Vendor state changed:", vendor);
	}, [vendor]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);

		try {
			await vendorService.updateProfile({ subdomain });
			toast.success("Store settings updated successfully");

			setVendor((prev) => (prev ? { ...prev, subdomain } : null));
		} catch (error) {
			console.error("[Vendor] Failed to update store:", error);
			toast.error("Failed to update store settings");
		} finally {
			setIsSubmitting(false);
		}
	};

	if (isLoading) {
		return (
			<ProtectedRoute allowedRoles={["vendor"]}>
				<DashboardLayout userRole="vendor">
					<div className="flex h-full items-center justify-center">
						<Spinner className="h-8 w-8" />
						<p className="ml-2">Loading vendor data...</p>
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
						<h1 className="text-3xl font-bold">Store Settings</h1>
						<p className="text-muted-foreground">Configure your online store</p>
					</div>

					{/* STATUS INDICATOR */}
					<Card
						className={
							vendor
								? "border-green-300 bg-green-50"
								: "border-red-300 bg-red-50"
						}
					>
						<CardContent className="pt-6">
							<div className="flex items-center gap-2">
								<div
									className={`h-3 w-3 rounded-full ${
										vendor ? "bg-green-500" : "bg-red-500"
									}`}
								/>
								<p className={vendor ? "text-green-800" : "text-red-800"}>
									{vendor
										? "✅ Vendor data loaded successfully"
										: "❌ No vendor data - Check debug panel below"}
								</p>
							</div>
							{vendor && (
								<div className="mt-2 text-sm text-gray-600">
									<p>Business: {vendor.businessName || "N/A"}</p>
									<p>Subdomain: {vendor.subdomain || "N/A"}</p>
								</div>
							)}
						</CardContent>
					</Card>

					{/* STORE INFO CARD */}
					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<HugeiconsIcon icon={Store01Icon} className="h-5 w-5" />
								<CardTitle>Store Information</CardTitle>
							</div>
							<CardDescription>
								Your store details and branding information
							</CardDescription>
						</CardHeader>

						<CardContent className="space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Business Name</Label>
									<Input
										value={vendor?.businessName || ""}
										disabled
										className={!vendor?.businessName ? "bg-yellow-50" : ""}
									/>
									{!vendor?.businessName && (
										<p className="text-xs text-yellow-600">
											⚠️ No business name
										</p>
									)}
								</div>

								<div className="space-y-2">
									<Label>Phone</Label>
									<Input
										value={vendor?.phone || ""}
										disabled
										className={!vendor?.phone ? "bg-yellow-50" : ""}
									/>
									{!vendor?.phone && (
										<p className="text-xs text-yellow-600">
											⚠️ No phone number
										</p>
									)}
								</div>

								<div className="space-y-2">
									<Label>Owner</Label>
									<Input
										value={
											vendor?.owner
												? `${vendor.owner.profile?.firstName || ""} ${
														vendor.owner.profile?.lastName || ""
													}`.trim()
												: ""
										}
										disabled
										className={!vendor?.owner ? "bg-yellow-50" : ""}
									/>
									{!vendor?.owner && (
										<p className="text-xs text-yellow-600">⚠️ No owner info</p>
									)}
								</div>

								<div className="space-y-2">
									<Label>Status</Label>
									<Input
										value={vendor?.status || ""}
										disabled
										className={
											vendor?.status === "active"
												? "text-green-600"
												: vendor?.status
													? "text-red-600"
													: "bg-yellow-50"
										}
									/>
									{!vendor?.status && (
										<p className="text-xs text-yellow-600">⚠️ No status</p>
									)}
								</div>
							</div>

							{vendor?.description && (
								<div className="space-y-2">
									<Label>Description</Label>
									<textarea
										value={vendor.description}
										disabled
										className="w-full p-2 border rounded-md bg-gray-50 resize-none"
										rows={3}
									/>
								</div>
							)}

							{vendor?.address && (
								<div className="space-y-2">
									<Label>Address</Label>
									<Input
										value={`${vendor.address.city || ""}, ${
											vendor.address.country || ""
										}`}
										disabled
									/>
								</div>
							)}

							<div className="space-y-2 pt-4 border-t">
								<Label>Store URL</Label>
								<Input
									value={
										vendor?.subdomain ? `${vendor.subdomain}.example.com` : ""
									}
									disabled
									className={!vendor?.subdomain ? "bg-yellow-50" : ""}
								/>
								{!vendor?.subdomain && (
									<p className="text-xs text-yellow-600">
										⚠️ No subdomain configured
									</p>
								)}

								{vendor?.subdomain && (
									<Link href={`/store/${vendor.subdomain}`} target="_blank">
										<Button type="button" variant="outline" className="mt-2">
											Visit Store
										</Button>
									</Link>
								)}
							</div>
						</CardContent>
					</Card>

					{/* SUBDOMAIN SETTINGS */}
					<Card>
						<CardHeader>
							<CardTitle>Store URL</CardTitle>
							<CardDescription>
								Configure your custom store subdomain
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleSubmit} className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="subdomain">Subdomain</Label>
									<div className="flex gap-2">
										<Input
											id="subdomain"
											value={subdomain}
											onChange={(e) =>
												setSubdomain(
													e.target.value
														.toLowerCase()
														.replace(/[^a-z0-9-]/g, ""),
												)
											}
											placeholder="your-store"
										/>
										<span className="flex items-center text-sm text-muted-foreground">
											.example.com
										</span>
									</div>

									{subdomain && (
										<p className="text-sm text-muted-foreground">
											Your store will be available at: {subdomain}.example.com
										</p>
									)}
								</div>

								<div className="flex gap-2">
									<Button type="submit" disabled={isSubmitting}>
										{isSubmitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
										Save Changes
									</Button>

									{vendor?.subdomain && (
										<Link href={`/store/${vendor.subdomain}`} target="_blank">
											<Button type="button" variant="outline">
												<HugeiconsIcon
													icon={Link02Icon}
													className="mr-2 h-4 w-4"
												/>
												View Store
											</Button>
										</Link>
									)}
								</div>
							</form>
						</CardContent>
					</Card>

					{/* ENHANCED DEBUG PANEL */}
					<Card className="border-2 border-purple-300 bg-purple-50">
						<CardHeader>
							<CardTitle className="text-purple-700">
								🐛 Debug Information
							</CardTitle>
							<CardDescription>
								Check console logs and verify data structure
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<h3 className="font-semibold text-sm">React State:</h3>
								<div className="bg-white p-3 rounded border">
									<p className="text-xs">
										<strong>vendor is null:</strong> {String(vendor === null)}
									</p>
									<p className="text-xs">
										<strong>vendor is undefined:</strong>{" "}
										{String(vendor === undefined)}
									</p>
									<p className="text-xs">
										<strong>vendor type:</strong> {typeof vendor}
									</p>
									<p className="text-xs">
										<strong>vendor has data:</strong> {String(!!vendor)}
									</p>
								</div>
							</div>

							<div className="space-y-2">
								<h3 className="font-semibold text-sm">Vendor Object:</h3>
								<pre className="bg-gray-900 text-green-400 p-4 rounded-md text-xs overflow-auto max-h-64">
									{JSON.stringify(vendor, null, 2)}
								</pre>
							</div>

							<div className="space-y-2">
								<h3 className="font-semibold text-sm">API Debug Info:</h3>
								<pre className="bg-gray-900 text-yellow-400 p-4 rounded-md text-xs overflow-auto max-h-64">
									{JSON.stringify(debugInfo, null, 2)}
								</pre>
							</div>

							<div className="bg-blue-100 p-3 rounded border border-blue-300">
								<p className="text-xs text-blue-800">
									<strong>💡 Tip:</strong> Open browser console (F12) to see
									detailed logs
								</p>
							</div>
						</CardContent>
					</Card>
				</div>
			</DashboardLayout>
		</ProtectedRoute>
	);
}


