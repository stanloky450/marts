"use client";

import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon, Add01Icon, PencilEdit02Icon, Delete02Icon, Upload01Icon, Link02Icon } from "@hugeicons/core-free-icons"
import { format } from "date-fns";
import { apiClient } from "@/lib/api-client";

// Constants
const AD_SLOTS = {
	HOME_HERO: "home_hero",
	MID_BANNER: "mid_banner",
	SIDEBAR: "sidebar",
	FOOTER: "footer",
};

interface Ad {
	_id: string;
	slot: string;
	imageUrl: string;
	description: string;
	price: number;
	startDate: string;
	endDate: string;
	targetUrl?: string;
	priority: number;
	active: boolean;
}

export default function AdsPage() {
	const [ads, setAds] = useState<Ad[]>([]);
	const [loading, setLoading] = useState(true);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingAd, setEditingAd] = useState<Ad | null>(null);
	const [uploadType, setUploadType] = useState("url"); // "url" or "file"
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [formData, setFormData] = useState({
		slot: "home_hero",
		imageUrl: "",
		description: "",
		price: "",
		startDate: "",
		endDate: "",
		targetUrl: "",
		priority: 0,
	});
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		fetchAds();
	}, []);

	const fetchAds = async () => {
		try {
			const response = await apiClient.get<any>("/adsplace");
			setAds(response.data?.data || response.data || []);
		} catch (error) {
			toast.error("Error fetching ads");
			console.error(error);
		} finally {
			setLoading(false);
		}
	};

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
	): void => {
		const { name, value } = e.currentTarget;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleSelectChange = (value: string): void => {
		setFormData((prev) => ({ ...prev, slot: value }));
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files[0]) {
			setSelectedFile(e.target.files[0]);
		}
	};

	const validateDuration = (start: string, end: string) => {
		if (!start || !end) return true;
		const startDate = new Date(start);
		const endDate = new Date(end);
		const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays >= 1 && diffDays <= 7;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateDuration(formData.startDate, formData.endDate)) {
			toast.error("Duration must be between 1 and 7 days");
			return;
		}

		if (uploadType === "file" && !selectedFile && !editingAd) {
			toast.error("Please select a file");
			return;
		}

		if (uploadType === "url" && !formData.imageUrl && !editingAd) {
			toast.error("Please enter an image URL");
			return;
		}

		setSubmitting(true);
		try {
			const url = editingAd ? `/adsplace/${editingAd._id}` : "/adsplace";
			const method = editingAd ? "PATCH" : "POST";

			const data = new FormData();
			data.append("slot", formData.slot);
			data.append("description", formData.description);
			data.append("price", String(formData.price));
			data.append("startDate", formData.startDate);
			data.append("endDate", formData.endDate);
			data.append("targetUrl", formData.targetUrl);
			data.append("priority", String(formData.priority));

			if (uploadType === "file" && selectedFile) {
				data.append("file", selectedFile);
			} else if (uploadType === "url" && formData.imageUrl) {
				data.append("imageUrl", formData.imageUrl);
			}

			// When using FormData, axios/apiClient should automatically set Content-Type to multipart/form-data
			// But we need to make sure apiClient handles it correctly.
			// Usually passing FormData object is enough.

			const response =
				method === "POST"
					? await apiClient.post(url, data)
					: await apiClient.patch(url, data);

			toast.success(
				editingAd ? "Ad updated successfully" : "Ad created successfully"
			);
			setIsDialogOpen(false);
			resetForm();
			fetchAds();
		} catch (error: any) {
			toast.error(error.message || "Something went wrong");
		} finally {
			setSubmitting(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Are you sure you want to delete this ad?")) return;

		try {
			await apiClient.delete(`/adsplace/${id}`);
			toast.success("Ad deleted successfully");
			fetchAds();
		} catch (error: any) {
			toast.error(error.message);
		}
	};

	const openEditDialog = (ad: Ad) => {
		setEditingAd(ad);
		setFormData({
			slot: ad.slot,
			imageUrl: ad.imageUrl,
			description: ad.description,
			price: String(ad.price),
			startDate: ad.startDate.split("T")[0],
			endDate: ad.endDate.split("T")[0],
			targetUrl: ad.targetUrl || "",
			priority: ad.priority,
		});
		setUploadType("url"); // Default to URL for editing, user can switch to file
		setSelectedFile(null);
		setIsDialogOpen(true);
	};

	const resetForm = () => {
		setEditingAd(null);
		setFormData({
			slot: "home_hero",
			imageUrl: "",
			description: "",
			price: "",
			startDate: "",
			endDate: "",
			targetUrl: "",
			priority: 0,
		});
		setUploadType("url");
		setSelectedFile(null);
	};

	return (
		<ProtectedRoute allowedRoles={["super_admin"]}>
			<DashboardLayout>
				<div className="space-y-6">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-3xl font-bold">Ads & Promotions</h1>
							<p className="text-muted-foreground">
								Manage storefront advertisements
							</p>
						</div>
						<Dialog
							open={isDialogOpen}
							onOpenChange={(open) => {
								setIsDialogOpen(open);
								if (!open) resetForm();
							}}
						>
							<DialogTrigger asChild>
								<Button>
									<HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" /> Create Ad
								</Button>
							</DialogTrigger>
							<DialogContent className="sm:max-w-[500px]">
								<DialogHeader>
									<DialogTitle>
										{editingAd ? "Edit Ad" : "Create New Ad"}
									</DialogTitle>
									<DialogDescription>
										Set up your ad details. Duration must be 1-7 days.
									</DialogDescription>
								</DialogHeader>
								<form onSubmit={handleSubmit} className="space-y-4">
									<div className="grid gap-2">
										<Label htmlFor="slot">Ad Slot</Label>
										<Select
											name="slot"
											value={formData.slot}
											onValueChange={handleSelectChange}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select slot" />
											</SelectTrigger>
											<SelectContent>
												{Object.values(AD_SLOTS).map((slot) => (
													<SelectItem key={slot} value={slot}>
														{slot.replace("_", " ").toUpperCase()}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									<div className="grid gap-2">
										<Label>Media Source</Label>
										<div className="flex gap-2 mb-2">
											<Button
												type="button"
												variant={uploadType === "url" ? "default" : "outline"}
												size="sm"
												onClick={() => setUploadType("url")}
												className="flex-1"
											>
												<HugeiconsIcon icon={Link02Icon} className="mr-2 h-4 w-4" /> URL
											</Button>
											<Button
												type="button"
												variant={uploadType === "file" ? "default" : "outline"}
												size="sm"
												onClick={() => setUploadType("file")}
												className="flex-1"
											>
												<HugeiconsIcon icon={Upload01Icon} className="mr-2 h-4 w-4" /> Upload
											</Button>
										</div>

										{uploadType === "url" ? (
											<Input
												id="imageUrl"
												name="imageUrl"
												value={formData.imageUrl}
												onChange={handleInputChange}
												placeholder="https://..."
												required={!editingAd}
											/>
										) : (
											<Input
												id="file"
												type="file"
												accept="image/*,video/*"
												onChange={handleFileChange}
												required={!editingAd}
											/>
										)}
									</div>

									<div className="grid gap-2">
										<Label htmlFor="description">Description</Label>
										<Textarea
											id="description"
											name="description"
											value={formData.description}
											onChange={handleInputChange}
											required
										/>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div className="grid gap-2">
											<Label htmlFor="price">Price</Label>
											<Input
												id="price"
												name="price"
												type="number"
												value={formData.price}
												onChange={handleInputChange}
												required
											/>
										</div>
										<div className="grid gap-2">
											<Label htmlFor="priority">Priority</Label>
											<Input
												id="priority"
												name="priority"
												type="number"
												value={formData.priority}
												onChange={handleInputChange}
											/>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div className="grid gap-2">
											<Label htmlFor="startDate">Start Date</Label>
											<Input
												id="startDate"
												name="startDate"
												type="date"
												value={formData.startDate}
												onChange={handleInputChange}
												required
											/>
										</div>
										<div className="grid gap-2">
											<Label htmlFor="endDate">End Date</Label>
											<Input
												id="endDate"
												name="endDate"
												type="date"
												value={formData.endDate}
												onChange={handleInputChange}
												required
											/>
										</div>
									</div>

									<div className="grid gap-2">
										<Label htmlFor="targetUrl">Target URL</Label>
										<Input
											id="targetUrl"
											name="targetUrl"
											value={formData.targetUrl}
											onChange={handleInputChange}
											placeholder="https://..."
										/>
									</div>

									<DialogFooter>
										<Button type="submit" disabled={submitting}>
											{submitting && (
												<HugeiconsIcon icon={Loading03Icon} className="mr-2 h-4 w-4 animate-spin" />
											)}
											{editingAd ? "Update Ad" : "Create Ad"}
										</Button>
									</DialogFooter>
								</form>
							</DialogContent>
						</Dialog>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>Active Ads</CardTitle>
							<CardDescription>List of all advertisements</CardDescription>
						</CardHeader>
						<CardContent>
							{loading ? (
								<div className="flex justify-center py-8">
									<HugeiconsIcon icon={Loading03Icon} className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Media</TableHead>
											<TableHead>Slot</TableHead>
											<TableHead>Description</TableHead>
											<TableHead>Duration</TableHead>
											<TableHead>Price</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{ads.length === 0 ? (
											<TableRow>
												<TableCell
													colSpan={7}
													className="text-center py-8 text-muted-foreground"
												>
													No ads found
												</TableCell>
											</TableRow>
										) : (
											ads.map((ad) => (
												<TableRow key={ad._id}>
													<TableCell>
														{ad.imageUrl?.match(/\.(mp4|webm|ogg)$/i) ? (
															<video
																src={ad.imageUrl}
																className="h-10 w-16 object-cover rounded"
																muted
																loop
																onMouseOver={(e) => (e.target as HTMLVideoElement).play()}
																onMouseOut={(e) => (e.target as HTMLVideoElement).pause()}
															/>
														) : (
															<img
																src={ad.imageUrl}
																alt="Ad"
																className="h-10 w-16 object-cover rounded"
																onError={(e) => {
																	(e.target as HTMLImageElement).src =
																		"https://placehold.co/64x40?text=No+Img";
																}}
															/>
														)}
													</TableCell>
													<TableCell className="font-medium capitalize">
														{ad.slot.replace("_", " ")}
													</TableCell>
													<TableCell className="max-w-[200px] truncate">
														{ad.description}
													</TableCell>
													<TableCell>
														<div className="text-xs">
															{format(new Date(ad.startDate), "MMM d")} -{" "}
															{format(new Date(ad.endDate), "MMM d")}
														</div>
													</TableCell>
													<TableCell>${ad.price}</TableCell>
													<TableCell>
														<span
															className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
																ad.active
																	? "bg-green-100 text-green-800"
																	: "bg-gray-100 text-gray-800"
															}`}
														>
															{ad.active ? "Active" : "Inactive"}
														</span>
													</TableCell>
													<TableCell className="text-right">
														<div className="flex justify-end gap-2">
															<Button
																variant="ghost"
																size="icon"
																onClick={() => openEditDialog(ad)}
															>
																<HugeiconsIcon icon={PencilEdit02Icon} className="h-4 w-4" />
															</Button>
															<Button
																variant="ghost"
																size="icon"
																onClick={() => handleDelete(ad._id)}
															>
																<HugeiconsIcon icon={Delete02Icon} className="h-4 w-4 text-red-500" />
															</Button>
														</div>
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</div>
			</DashboardLayout>
		</ProtectedRoute>
	);
}


