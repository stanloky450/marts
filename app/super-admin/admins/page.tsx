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
	adminService,
	type CreateAdminData,
} from "@/lib/services/admin.service";
import { locationService, type Location } from "@/lib/services/location.service";
import type { Admin, User, Vendor } from "@/lib/types";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, PencilEdit02Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { apiClient } from "@/lib/api-client";


type AssignmentMode = "none" | "location" | "vendor" | "referral";

const MODE_LABELS: Record<AssignmentMode, string> = {
	none: "No Assignment",
	location: "By Location",
	vendor: "By Vendor",
	referral: "By Referral Code",
};

const DEFAULT_FORM: CreateAdminData = {
	email: "",
	password: "",
	region: "",
	notes: "",
	firstName: "",
	lastName: "",
	assignmentMode: "none",
	locationRegion: "",
	vendorIds: [],
	referralCode: "",
};

export default function AdminsPage() {
	const [admins, setAdmins] = useState<Array<Admin & { email: string; status: string }>>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);

	const [formData, setFormData] = useState<CreateAdminData>(DEFAULT_FORM);
	const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("none");

	// Dropdown data
	const [locations, setLocations] = useState<Location[]>([]);
	const [vendors, setVendors] = useState<Vendor[]>([]);
	const [loadingLocations, setLoadingLocations] = useState(false);
	const [loadingVendors, setLoadingVendors] = useState(false);

	// Multi-select vendor state
	const [vendorSearch, setVendorSearch] = useState("");
	const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);

	// ─── Data fetching ────────────────────────────────────────────────────────

	const fetchAdmins = async () => {
		try {
			const response = await adminService.getAll();
			const raw = response.data?.data;

			// Backend now returns the user directly (array of user docs with role admin)
			const list: any[] = Array.isArray(raw) ? raw : raw?.admins ?? [];

			const combined = list.map((admin: any) => ({
				...admin,
				firstName: admin.profile?.firstName ?? admin.firstName ?? "",
				lastName: admin.profile?.lastName ?? admin.lastName ?? "",
				email: admin.email ?? "",
				status: admin.status ?? "active",
				region: admin.profile?.region ?? admin.region ?? "",
				notes: admin.profile?.notes ?? admin.notes ?? "",
			}));

			setAdmins(combined);
		} catch (error) {
			console.error("Failed to fetch admins:", error);
			toast.error("Failed to load admins");
		} finally {
			setIsLoading(false);
		}
	};

	const fetchLocations = async () => {
		if (locations.length > 0) return;
		setLoadingLocations(true);
		try {
			const res = await locationService.getLocations();
			// @ts-ignore
			setLocations(res.data.data ?? []);
		} catch {
			toast.error("Failed to load locations");
		} finally {
			setLoadingLocations(false);
		}
	};

	const fetchVendors = async () => {
		if (vendors.length > 0) return;
		setLoadingVendors(true);
		try {
			// Use the super-admin vendor list endpoint
			const res = await apiClient.get<any>("/vendors?limit=200&status=active");
			const data = res.data?.data;
			const list: Vendor[] = Array.isArray(data) ? data : data?.vendors ?? [];
			setVendors(list);
		} catch {
			toast.error("Failed to load vendors");
		} finally {
			setLoadingVendors(false);
		}
	};

	useEffect(() => {
		fetchAdmins();
	}, []);

	// Pre-load data relevant to chosen mode
	useEffect(() => {
		if (assignmentMode === "location") fetchLocations();
		if (assignmentMode === "vendor") fetchVendors();
	}, [assignmentMode]);

	// ─── Form helpers ─────────────────────────────────────────────────────────

	const resetDialog = () => {
		setFormData(DEFAULT_FORM);
		setAssignmentMode("none");
		setSelectedVendorIds([]);
		setVendorSearch("");
		setIsEditing(false);
		setSelectedAdminId(null);
	};

	const toggleVendor = (id: string) => {
		setSelectedVendorIds((prev) =>
			prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
		);
	};

	const filteredVendors = vendors.filter((v) =>
		(v.businessName ?? "").toLowerCase().includes(vendorSearch.toLowerCase())
	);

	// ─── Submit ───────────────────────────────────────────────────────────────

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);

		try {
			if (isEditing && selectedAdminId) {
				await adminService.update(selectedAdminId, formData);
				toast.success("Admin updated successfully");
			} else {
				const payload: CreateAdminData = {
					...formData,
					assignmentMode,
				};
				if (assignmentMode === "vendor") {
					if (selectedVendorIds.length === 0) {
						toast.error("Please select at least one vendor");
						setIsSubmitting(false);
						return;
					}
					payload.vendorIds = selectedVendorIds;
				} else if (assignmentMode === "location") {
					payload.locationRegion = formData.locationRegion;
				} else if (assignmentMode === "referral") {
					payload.referralCode = formData.referralCode;
				}
				await adminService.create(payload);
				toast.success("Admin created successfully");
			}

			setIsDialogOpen(false);
			resetDialog();
			fetchAdmins();
		} catch (error: any) {
			console.error("Failed to save admin:", error);
			toast.error(
				error?.response?.data?.error?.message ??
				(isEditing ? "Failed to update admin" : "Failed to create admin")
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleEditClick = (admin: any) => {
		setIsEditing(true);
		setSelectedAdminId(admin._id);
		setFormData({
			firstName: admin.firstName || "",
			lastName: admin.lastName || "",
			email: admin.email || "",
			password: "",
			region: admin.region || "",
			notes: admin.notes || "",
			assignmentMode: "none",
		});
		setAssignmentMode("none");
		setIsDialogOpen(true);
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Are you sure you want to delete this admin?")) return;
		try {
			await adminService.delete(id);
			toast.success("Admin deleted successfully");
			fetchAdmins();
		} catch (error) {
			console.error("Failed to delete admin:", error);
			toast.error("Failed to delete admin");
		}
	};

	// ─── Render ───────────────────────────────────────────────────────────────

	return (
		<ProtectedRoute allowedRoles={["super_admin"]}>
			<DashboardLayout>
				<div className="space-y-6">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-3xl font-bold">Admins</h1>
							<p className="text-muted-foreground">
								Manage platform administrators
							</p>
						</div>

						<Dialog
							open={isDialogOpen}
							onOpenChange={(open) => {
								setIsDialogOpen(open);
								if (!open) resetDialog();
							}}
						>
							<DialogTrigger asChild>
								<Button
									onClick={() => {
										resetDialog();
									}}
								>
									<HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
									Create Admin
								</Button>
							</DialogTrigger>

							<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
								<DialogHeader>
									<DialogTitle>
										{isEditing ? "Edit Admin" : "Create New Admin"}
									</DialogTitle>
									<DialogDescription>
										{isEditing
											? "Update this administrator's details"
											: "Add a new administrator to the platform"}
									</DialogDescription>
								</DialogHeader>

								<form onSubmit={handleSubmit} className="space-y-4 pt-2">
									{/* ── Basic details ── */}
									<div className="grid grid-cols-2 gap-3">
										<div className="space-y-1">
											<Label htmlFor="firstName">First Name</Label>
											<Input
												id="firstName"
												value={formData.firstName}
												onChange={(e) =>
													setFormData({ ...formData, firstName: e.target.value })
												}
												required
											/>
										</div>
										<div className="space-y-1">
											<Label htmlFor="lastName">Last Name</Label>
											<Input
												id="lastName"
												value={formData.lastName}
												onChange={(e) =>
													setFormData({ ...formData, lastName: e.target.value })
												}
												required
											/>
										</div>
									</div>

									<div className="space-y-1">
										<Label htmlFor="email">Email</Label>
										<Input
											id="email"
											type="email"
											value={formData.email}
											onChange={(e) =>
												setFormData({ ...formData, email: e.target.value })
											}
											required
										/>
									</div>

									{!isEditing && (
										<div className="space-y-1">
											<Label htmlFor="password">Password</Label>
											<Input
												id="password"
												type="password"
												value={formData.password}
												onChange={(e) =>
													setFormData({ ...formData, password: e.target.value })
												}
												required={!isEditing}
											/>
										</div>
									)}

									<div className="space-y-1">
										<Label htmlFor="notes">Notes (Optional)</Label>
										<Input
											id="notes"
											value={formData.notes}
											onChange={(e) =>
												setFormData({ ...formData, notes: e.target.value })
											}
										/>
									</div>

									{/* ── Assignment mode (create only) ── */}
									{!isEditing && (
										<div className="space-y-3 rounded-lg border p-3">
											<div className="space-y-1">
												<Label>Assignment Mode</Label>
												<p className="text-xs text-muted-foreground">
													Optionally auto-assign vendors to this admin
												</p>
											</div>

											{/* Mode tabs */}
											<div className="grid grid-cols-4 gap-1 rounded-md bg-muted p-1">
												{(["none", "location", "vendor", "referral"] as AssignmentMode[]).map(
													(mode) => (
														<button
															key={mode}
															type="button"
															onClick={() => setAssignmentMode(mode)}
															className={`rounded px-2 py-1.5 text-xs font-medium transition-colors ${
																assignmentMode === mode
																	? "bg-background shadow text-foreground"
																	: "text-muted-foreground hover:text-foreground"
															}`}
														>
															{MODE_LABELS[mode]}
														</button>
													)
												)}
											</div>

											{/* ── By Location ── */}
											{assignmentMode === "location" && (
												<div className="space-y-1">
													<Label htmlFor="locationRegion">Select Region</Label>
													{loadingLocations ? (
														<div className="flex items-center gap-2 text-sm text-muted-foreground">
															<Spinner className="h-4 w-4" /> Loading locations…
														</div>
													) : (
														<select
															id="locationRegion"
															className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
															value={formData.locationRegion || ""}
															onChange={(e) =>
																setFormData({ ...formData, locationRegion: e.target.value })
															}
														>
															<option value="" disabled>Choose a region…</option>
															{locations.length === 0 && (
																<option value="" disabled>No locations configured</option>
															)}
															{locations.map((loc) => (
																<option key={loc._id} value={loc.region}>
																	{loc.region}
																	{loc.areas?.length
																		? ` (${loc.areas.length} areas)`
																		: ""}
																</option>
															))}
														</select>
													)}
													{formData.locationRegion && (
														<p className="text-xs text-muted-foreground mt-1">
															All active vendors in <strong>{formData.locationRegion}</strong> will be assigned to this admin.
														</p>
													)}
												</div>
											)}

											{/* ── By Vendor ── */}
											{assignmentMode === "vendor" && (
												<div className="space-y-2">
													<Label>Select Vendors</Label>
													{loadingVendors ? (
														<div className="flex items-center gap-2 text-sm text-muted-foreground">
															<Spinner className="h-4 w-4" /> Loading vendors…
														</div>
													) : (
														<>
															<Input
																placeholder="Search vendors…"
																value={vendorSearch}
																onChange={(e) => setVendorSearch(e.target.value)}
															/>
															<div className="max-h-40 overflow-y-auto rounded-md border divide-y">
																{filteredVendors.length === 0 && (
																	<p className="px-3 py-2 text-xs text-muted-foreground">
																		No vendors found
																	</p>
																)}
																{filteredVendors.map((vendor) => {
																	const checked = selectedVendorIds.includes(
																		vendor._id as string
																	);
																	return (
																		<label
																			key={vendor._id as string}
																			className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
																		>
																			<input
																				type="checkbox"
																				checked={checked}
																				onChange={() =>
																					toggleVendor(vendor._id as string)
																				}
																				className="rounded border-border"
																			/>
																			<span>
																				{vendor.businessName ?? "Unnamed vendor"}
																			</span>
																		</label>
																	);
																})}
															</div>
															{selectedVendorIds.length > 0 && (
																<p className="text-xs text-muted-foreground">
																	{selectedVendorIds.length} vendor(s) selected
																</p>
															)}
														</>
													)}
												</div>
											)}

											{/* ── By Referral Code ── */}
											{assignmentMode === "referral" && (
												<div className="space-y-1">
													<Label htmlFor="referralCode">Referral Code</Label>
													<Input
														id="referralCode"
														placeholder="e.g. AGENT2024"
														value={formData.referralCode}
														onChange={(e) =>
															setFormData({
																...formData,
																referralCode: e.target.value,
															})
														}
													/>
													<p className="text-xs text-muted-foreground">
														All vendors who registered using this code will be assigned to this admin.
													</p>
												</div>
											)}
										</div>
									)}

									<Button
										type="submit"
										className="w-full"
										disabled={isSubmitting}
									>
										{isSubmitting && <Spinner className="mr-2 h-4 w-4" />}
										{isEditing ? "Save Changes" : "Create Admin"}
									</Button>
								</form>
							</DialogContent>
						</Dialog>
					</div>

					{/* ── Admin table ── */}
					{isLoading ? (
						<div className="flex justify-center py-8">
							<Spinner className="h-8 w-8" />
						</div>
					) : (
						<div className="rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Email</TableHead>
										<TableHead>Region</TableHead>
										<TableHead>Assigned Vendors</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Notes</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{admins.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={7}
												className="text-center text-muted-foreground"
											>
												No admins found
											</TableCell>
										</TableRow>
									) : (
										admins.map((admin) => (
											<TableRow key={admin._id}>
												<TableCell className="font-medium">
													{admin.firstName} {admin.lastName}
												</TableCell>
												<TableCell>{admin.email}</TableCell>
												<TableCell>{admin.region || "—"}</TableCell>
												<TableCell>
													{(admin as any).assignedVendors ?? "—"}
												</TableCell>
												<TableCell>
													<span
														className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
															admin.status === "active"
																? "bg-green-100 text-green-800"
																: "bg-red-100 text-red-800"
														}`}
													>
														{admin.status}
													</span>
												</TableCell>
												<TableCell>{admin.notes || "—"}</TableCell>
												<TableCell className="text-right">
													<div className="flex justify-end gap-2">
														<Button
															variant="ghost"
															size="icon"
															onClick={() => handleEditClick(admin)}
														>
															<HugeiconsIcon
																icon={PencilEdit02Icon}
																className="h-4 w-4"
															/>
														</Button>
														<Button
															variant="ghost"
															size="icon"
															onClick={() => handleDelete(admin._id)}
														>
															<HugeiconsIcon
																icon={Delete02Icon}
																className="h-4 w-4 text-destructive"
															/>
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
