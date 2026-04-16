"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
	vendorService,
	type CreateProductData,
} from "@/lib/services/vendor.service";
import { categoryService } from "@/lib/services/category.service";
import type { Product, Category } from "@/lib/types";
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, PencilEdit02Icon, Delete02Icon, Search01Icon } from "@hugeicons/core-free-icons"
import {
	Copy,
	ExternalLink,
	Facebook,
	Instagram,
	MessageCircle,
	Share2,
	Twitter,
} from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { productService } from "@/lib/services/product.service";
import { apiClient } from "@/lib/api-client";

export default function VendorProductsPage() {
	interface ProductFormData extends CreateProductData {
		productType: "product" | "service";
		priceMode: "fixed" | "range";
		priceMin?: number;
		priceMax?: number;
		duration?: string;
		videoUrl?: string;
	}

	const [products, setProducts] = useState<Product[]>([]);
	const [categories, setCategories] = useState<Category[]>([]);
	const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [editingProduct, setEditingProduct] = useState<Product | null>(null);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [formData, setFormData] = useState<ProductFormData>({
		productType: "product",
		priceMode: "fixed",
		name: "",
		description: "",
		price: 0,
		stock: 0,
		sku: "",
		categoryId: "",
		images: [], // <-- multiple files
		priceMin: undefined,
		priceMax: undefined,
		duration: "",
		videoUrl: "",
	});

	const [imagePreviews, setImagePreviews] = useState<string[]>([]); // URLs
	const [existingImages, setExistingImages] = useState<string[]>([]); // for edit mode
	const [error, setError] = useState("");
	const [uploadingImages, setUploadingImages] = useState(false);
	const [vendorSubdomain, setVendorSubdomain] = useState("");
	const [shareDialogOpen, setShareDialogOpen] = useState(false);
	const [recentlyCreatedProduct, setRecentlyCreatedProduct] = useState<Product | null>(
		null
	);
	const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

	const fetchProducts = async () => {
		try {
			const params: Record<string, string> = {};
			if (search) params.search = search;
			if (statusFilter !== "all") params.status = statusFilter;

			const response = await vendorService.getProducts(params);
			setProducts(response.data.data);
		} catch (error) {
			console.error("Failed to fetch products:", error);
			toast.error("Failed to load products");
		} finally {
			setIsLoading(false);
		}
	};

	const fetchCategories = async () => {
		try {
			setIsCategoriesLoading(true);
			const response = await categoryService.getAll();
			setCategories(
				response.data.data.filter((cat) => cat.status === "active")
			);
		} catch (error) {
			console.error(" Failed to fetch categories:", error);
			toast.error("Failed to load categories");
		} finally {
			setIsCategoriesLoading(false);
		}
	};

	useEffect(() => {
		fetchProducts();
	}, [search, statusFilter]);

	useEffect(() => {
		setSelectedProductIds((prev) =>
			prev.filter((id) => products.some((p) => p._id === id))
		);
	}, [products]);

	// Load categories once on mount
	useEffect(() => {
		fetchCategories();
		(async () => {
			try {
				const profile = await vendorService.getProfile();
				setVendorSubdomain(profile.data.data.vendor.subdomain || "");
			} catch {
				setVendorSubdomain("");
			}
		})();
	}, []);

	const getProductUrl = (product: Product) => {
		const productId = product?._id;
		if (!productId) return "";
		if (typeof window === "undefined") return "";
		if (!vendorSubdomain) return `${window.location.origin}/products/${productId}`;
		return `${window.location.origin}/store/${vendorSubdomain}/products/${productId}`;
	};

	const copyToClipboard = async (value: string, label: string) => {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(`${label} copied`);
		} catch {
			toast.error(`Failed to copy ${label.toLowerCase()}`);
		}
	};

	const shareProduct = async (
		product: Product,
		platform: "copy" | "whatsapp" | "facebook" | "x" | "instagram"
	) => {
		const url = getProductUrl(product);
		if (!url) {
			toast.error("Unable to generate product link");
			return;
		}
		const text = `Check out "${product.name}" on my store`;
		const encodedUrl = encodeURIComponent(url);
		const encodedText = encodeURIComponent(text);

		if (platform === "copy") {
			await copyToClipboard(url, "Product link");
			return;
		}

		if (platform === "whatsapp") {
			window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener,noreferrer");
			return;
		}

		if (platform === "facebook") {
			window.open(
				`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
				"_blank",
				"noopener,noreferrer"
			);
			return;
		}

		if (platform === "x") {
			window.open(
				`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
				"_blank",
				"noopener,noreferrer"
			);
			return;
		}

		// Instagram web doesn't support direct URL-share. Copy text + open Instagram.
		await copyToClipboard(`${text} ${url}`, "Instagram caption");
		window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
	};

	const toggleProductSelection = (id: string, checked: boolean) => {
		setSelectedProductIds((prev) =>
			checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)
		);
	};

	const toggleSelectAllVisible = (checked: boolean) => {
		if (checked) {
			setSelectedProductIds(Array.from(new Set([...selectedProductIds, ...products.map((p) => p._id)])));
			return;
		}
		setSelectedProductIds((prev) => prev.filter((id) => !products.some((p) => p._id === id)));
	};

	const shareSelectedProducts = async (
		platform: "copy" | "whatsapp" | "facebook" | "x" | "instagram" | "open_all"
	) => {
		const selectedProducts = products.filter((p) =>
			selectedProductIds.includes(p._id)
		);
		if (selectedProducts.length === 0) {
			toast.error("Select at least one product");
			return;
		}

		const rows = selectedProducts
			.map((product) => {
				const url = getProductUrl(product);
				return url ? `${product.name} - ${url}` : "";
			})
			.filter(Boolean);

		if (rows.length === 0) {
			toast.error("Unable to generate product links");
			return;
		}

		const bulkText = `Check out my products:\n${rows.join("\n")}`;
		const firstUrl = rows[0].split(" - ").slice(1).join(" - ");

		if (platform === "copy") {
			await copyToClipboard(bulkText, "Selected product links");
			return;
		}

		if (platform === "whatsapp") {
			window.open(
				`https://wa.me/?text=${encodeURIComponent(bulkText)}`,
				"_blank",
				"noopener,noreferrer"
			);
			return;
		}

		if (platform === "x") {
			window.open(
				`https://twitter.com/intent/tweet?text=${encodeURIComponent(bulkText)}`,
				"_blank",
				"noopener,noreferrer"
			);
			return;
		}

		if (platform === "facebook") {
			await copyToClipboard(bulkText, "Selected product links");
			window.open(
				`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(firstUrl)}`,
				"_blank",
				"noopener,noreferrer"
			);
			return;
		}

		if (platform === "instagram") {
			await copyToClipboard(bulkText, "Selected product links");
			window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
			return;
		}

		selectedProducts.forEach((product) => {
			const url = getProductUrl(product);
			if (url) {
				window.open(url, "_blank", "noopener,noreferrer");
			}
		});
	};

	const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files) return;

		try {
			setUploadingImages(true);
			const uploadedUrls: string[] = [];

			for (let i = 0; i < files.length; i++) {
				const uploadFormData = new FormData();
				uploadFormData.append("file", files[i]);

				// console.log("[v0] Uploading file:", file.name);
				const response = await apiClient.post<{ imageUrl: string }>(
					"/media/uploadfile",
					uploadFormData,
					{
						headers: { "Content-Type": "multipart/form-data" },
					}
				);

				uploadedUrls.push(response.data.imageUrl);
			}

			setFormData((prev) => ({
				...prev,
				images: [...(prev.images || []), ...uploadedUrls],
			}));
			setError("");
		} catch (err) {
			setError("Failed to upload images");
			console.error(err);
		} finally {
			setUploadingImages(false);
		}
	};

	const removeImage = (index: number) => {
		setFormData((prev) => ({
			...prev,
			images: (prev.images ?? []).filter((_, i) => i !== index),
		}));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);

		try {
			const isService = formData.productType === "service";
			if (isService) {
				if ((formData.images?.length ?? 0) < 2) {
					toast.error("Services require at least 2 images");
					return;
				}
				if (!formData.duration?.trim()) {
					toast.error("Duration is required for a service");
					return;
				}
				if (!formData.videoUrl?.trim()) {
					toast.error("Video link is required for a service");
					return;
				}
				if (formData.priceMode === "fixed") {
					if (!Number.isFinite(formData.price) || Number(formData.price) <= 0) {
						toast.error("Enter a valid service price");
						return;
					}
				} else {
					if (
						!Number.isFinite(formData.priceMin) ||
						!Number.isFinite(formData.priceMax)
					) {
						toast.error("Enter both minimum and maximum price for service range");
						return;
					}
					if (Number(formData.priceMin) > Number(formData.priceMax)) {
						toast.error("Minimum price cannot be greater than maximum price");
						return;
					}
				}
			}

			// Map form data to backend payload
			const payload = {
				productType: formData.productType,
				name: formData.name,
				description: formData.description,
				category: formData.categoryId, // backend expects 'category'
				price:
					formData.productType === "service"
						? formData.priceMode === "fixed"
							? Number(formData.price)
							: undefined
						: formData.price,
				priceMin:
					formData.productType === "service" && formData.priceMode === "range"
						? Number(formData.priceMin)
						: undefined,
				priceMax:
					formData.productType === "service" && formData.priceMode === "range"
						? Number(formData.priceMax)
						: undefined,
				duration: formData.productType === "service" ? formData.duration?.trim() : undefined,
				videoUrl: formData.productType === "service" ? formData.videoUrl?.trim() : undefined,
				stock: formData.productType === "service" ? 1 : formData.stock,
				sku: formData.sku,
				images: formData.images,
				// tags, variants can be added here when available
			};

			if (editingProduct) {
				await productService.update(editingProduct._id, payload);
				toast.success("Product updated successfully");
			} else {
				const created = await productService.create(payload);
				const createdProduct = created.data.data;
				toast.success("Product created successfully");
				setRecentlyCreatedProduct(createdProduct);
				setShareDialogOpen(true);
			}
			setIsDialogOpen(false);
			setEditingProduct(null);
			setFormData({
				productType: "product",
				priceMode: "fixed",
				name: "",
				description: "",
				price: 0,
				stock: 0,
				sku: "",
				categoryId: "",
				images: [],
				priceMin: undefined,
				priceMax: undefined,
				duration: "",
				videoUrl: "",
			});
			fetchProducts();
		} catch (error: any) {
			const message =
				error?.response?.data?.message ||
				error?.message ||
				"Failed to save product";
			console.error(" Failed to save product:", error);
			toast.error(message);
		} finally {
			setIsSubmitting(false);
		}
	};

	// const handleSubmit = async (e: React.FormEvent) => {
	// 	e.preventDefault();
	// 	setIsSubmitting(true);

	// 	try {
	// 		const form = new FormData();

	// 		form.append("name", formData.name);
	// 		form.append("description", formData.description);
	// 		form.append("category", formData.categoryId);
	// 		form.append("price", String(formData.price));
	// 		form.append("stock", String(formData.stock));
	// 		form.append("sku", formData.sku);

	// 		// Send existing images (that user didn't delete)
	// 		existingImages.forEach((url) => form.append("existingImages[]", url));

	// 		// Send new uploaded images
	// 		formData.images.forEach((file) => {
	// 			form.append("images", file); // backend: upload.array("images")
	// 		});

	// 		if (editingProduct) {
	// 			await productService.update(editingProduct._id, form, true);
	// 			toast.success("Product updated successfully");
	// 		} else {
	// 			await productService.create(form, true);
	// 			toast.success("Product added successfully");
	// 		}

	// 		// Reset everything
	// 		setEditingProduct(null);
	// 		setFormData({
	// 			name: "",
	// 			description: "",
	// 			price: 0,
	// 			stock: 0,
	// 			sku: "",
	// 			categoryId: "",
	// 			images: [],
	// 		});
	// 		setImagePreviews([]);
	// 		setExistingImages([]);
	// 		setIsDialogOpen(false);

	// 		fetchProducts();
	// 	} catch (err: any) {
	// 		toast.error(err?.response?.data?.message || "Error saving product.");
	// 	} finally {
	// 		setIsSubmitting(false);
	// 	}
	// };

	// const handleEdit = (product: Product) => {
	// 	setEditingProduct(product);
	// 	setFormData({
	// 		name: product.name,
	// 		description: product.description,
	// 		price: product.price,
	// 		stock: product.stock,
	// 		sku: product.sku,
	// 		categoryId: product.category,
	// 	});
	// 	setIsDialogOpen(true);
	// };

	const handleEdit = (product: Product) => {
		setEditingProduct(product);
		const serviceMeta =
			product.variants &&
			!Array.isArray(product.variants) &&
			typeof product.variants === "object" &&
			(product.variants as any).kind === "service"
				? (product.variants as any)
				: null;
		const isService = (product as any).productType === "service" || !!serviceMeta;
		const resolvedCategoryId =
			typeof product.category === "string"
				? product.category
				: (product.category as unknown as { _id?: string })?._id || "";

		setFormData({
			productType: isService ? "service" : "product",
			priceMode: isService && Number(serviceMeta?.priceMin) !== Number(serviceMeta?.priceMax) ? "range" : "fixed",
			name: product.name,
			description: product.description,
			price: isService ? Number(serviceMeta?.priceMin ?? product.price) : product.price,
			stock: isService ? 1 : product.stock,
			sku: product.sku,
			categoryId: resolvedCategoryId,
			images: [], // new images only
			priceMin: isService ? Number(serviceMeta?.priceMin ?? product.price) : undefined,
			priceMax: isService ? Number(serviceMeta?.priceMax ?? product.price) : undefined,
			duration: isService ? serviceMeta?.duration || "" : "",
			videoUrl: isService ? serviceMeta?.videoUrl || "" : "",
		});

		setExistingImages(product.images || []); // URLs from DB
		setImagePreviews([]); // clear new previews
		setIsDialogOpen(true);
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Are you sure you want to delete this product?")) return;

		try {
			await vendorService.deleteProduct(id);
			toast.success("Product deleted successfully");
			fetchProducts();
		} catch (error) {
			console.error("[v0] Failed to delete product:", error);
			toast.error("Failed to delete product");
		}
	};

	const handleDialogClose = (open: boolean) => {
		setIsDialogOpen(open);
		if (!open) {
			setEditingProduct(null);
			setFormData({
				productType: "product",
				priceMode: "fixed",
				name: "",
				description: "",
				price: 0,
				stock: 0,
				sku: "",
				categoryId: "",
				images: [],
				priceMin: undefined,
				priceMax: undefined,
				duration: "",
				videoUrl: "",
			});
		} else {
			// Ensure categories are available when opening the dialog
			if (categories.length === 0 && !isCategoriesLoading) {
				void fetchCategories();
			}
		}
	};

	return (
		<ProtectedRoute allowedRoles={["vendor"]}>
			<DashboardLayout userRole="vendor">
				<div className="space-y-6">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-3xl font-bold">Products</h1>
							<p className="text-muted-foreground">
								Manage your product inventory
							</p>
						</div>
						<Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
							<DialogTrigger asChild>
								<Button>
									<HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
									Add Product
								</Button>
							</DialogTrigger>
							<DialogContent className="max-h-[90vh] overflow-y-auto">
								<DialogHeader>
									<DialogTitle>
										{editingProduct ? "Edit Product" : "Add New Product"}
									</DialogTitle>
									<DialogDescription>
										{editingProduct
											? "Update product details"
											: "Create a new product for your store"}
									</DialogDescription>
								</DialogHeader>
								<form onSubmit={handleSubmit} className="space-y-4">
	<div className="space-y-2">
		<Label htmlFor="productType">Creation Type</Label>
		<Select
			value={formData.productType}
			onValueChange={(value: "product" | "service") =>
				setFormData((prev) => ({
					...prev,
					productType: value,
					priceMode: value === "service" ? prev.priceMode : "fixed",
					stock: value === "service" ? 1 : prev.stock,
				}))
			}
		>
			<SelectTrigger id="productType">
				<SelectValue placeholder="Choose type" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="product">Create Product</SelectItem>
				<SelectItem value="service">Create Service</SelectItem>
			</SelectContent>
		</Select>
	</div>
	<div className="space-y-2">
		<Label htmlFor="name">{formData.productType === "service" ? "Service Name" : "Product Name"}</Label>
		<Input
			id="name"
			value={formData.name}
			onChange={(e) => setFormData({ ...formData, name: e.target.value })}
			required
		/>
	</div>
	<div className="space-y-2">
		<Label htmlFor="sku">SKU</Label>
		<Input
			id="sku"
			value={formData.sku}
			onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
		/>
		<p className="text-xs text-muted-foreground">Optional. SKU will be auto-generated if empty.</p>
	</div>
	<div className="space-y-2">
		<Label htmlFor="description">Description</Label>
		<Textarea
			id="description"
			value={formData.description}
			onChange={(e) => setFormData({ ...formData, description: e.target.value })}
			rows={3}
			required
		/>
	</div>
	{formData.productType === "service" ? (
		<div className="space-y-4 rounded-md border p-4">
			<div className="space-y-2">
				<Label htmlFor="duration">Duration (Required)</Label>
				<Input
					id="duration"
					placeholder="e.g. 2-4 days"
					value={formData.duration || ""}
					onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="videoUrl">Video Link (Required)</Label>
				<Input
					id="videoUrl"
					type="url"
					placeholder="https://youtube.com/..."
					value={formData.videoUrl || ""}
					onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
					required
				/>
			</div>
			<div className="space-y-2">
				<Label>Pricing Type</Label>
				<Select
					value={formData.priceMode}
					onValueChange={(value: "fixed" | "range") => setFormData({ ...formData, priceMode: value })}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="fixed">Single Price</SelectItem>
						<SelectItem value="range">Price Range</SelectItem>
					</SelectContent>
				</Select>
			</div>
			{formData.priceMode === "fixed" ? (
				<div className="space-y-2">
					<Label htmlFor="price">Service Price (NGN)</Label>
					<Input
						id="price"
						type="number"
						min="0"
						step="0.01"
						value={formData.price}
						onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
						required
					/>
				</div>
			) : (
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="priceMin">Min Price (NGN)</Label>
						<Input
							id="priceMin"
							type="number"
							min="0"
							step="0.01"
							value={formData.priceMin ?? ""}
							onChange={(e) => setFormData({ ...formData, priceMin: Number(e.target.value) })}
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="priceMax">Max Price (NGN)</Label>
						<Input
							id="priceMax"
							type="number"
							min="0"
							step="0.01"
							value={formData.priceMax ?? ""}
							onChange={(e) => setFormData({ ...formData, priceMax: Number(e.target.value) })}
							required
						/>
					</div>
				</div>
			)}
		</div>
	) : (
		<div className="grid grid-cols-2 gap-4">
			<div className="space-y-2">
				<Label htmlFor="price">Price (NGN)</Label>
				<Input
					id="price"
					type="number"
					min="0"
					step="0.01"
					value={formData.price}
					onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="stock">Stock</Label>
				<Input
					id="stock"
					type="number"
					min="0"
					value={formData.stock}
					onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
					required
				/>
			</div>
		</div>
	)}

	<div className="space-y-2">
		<label className="block text-sm font-semibold">
			{formData.productType === "service" ? "Service Images" : "Product Images"}
		</label>
										<Input
											type="file"
											accept="image/*"
											multiple
											onChange={handleImageUpload}
											disabled={uploadingImages}
										/>
										{uploadingImages && (
											<span className="text-sm text-gray-500">
												Uploading images...
											</span>
										)}
										{formData.productType === "service" && (
											<p className="text-xs text-muted-foreground">
												At least 2 images are required for services.
											</p>
										)}

										{Array.isArray(formData.images) &&
											formData.images.length > 0 && (
												<div className="grid grid-cols-4 gap-2 mt-4">
													{formData.images.map((image, index) => (
														<div key={index} className="relative group">
															<img
																src={image || "/placeholder.svg"}
																alt={`Product ${index}`}
																className="w-full h-20 object-cover rounded"
															/>
															<button
																type="button"
																onClick={() => removeImage(index)}
																className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
															>
																×
															</button>
														</div>
													))}
												</div>
											)}
									</div>

									<div className="space-y-2">
										<Label htmlFor="categoryId">Category</Label>
										<Select
											value={formData.categoryId}
											onValueChange={(value) =>
												setFormData({ ...formData, categoryId: value })
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select a category" />
											</SelectTrigger>
											<SelectContent>
												{isCategoriesLoading ? (
													<SelectItem disabled value="loading">
														Loading categories...
													</SelectItem>
												) : categories.length === 0 ? (
													<SelectItem disabled value="empty">
														No categories found
													</SelectItem>
												) : (
													categories.map((category) => (
														<SelectItem key={category._id} value={category._id}>
															{category.name}
														</SelectItem>
													))
												)}
											</SelectContent>
										</Select>
									</div>
									<Button
										type="submit"
										className="w-full"
										disabled={isSubmitting}
									>
										{isSubmitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
										{editingProduct ? "Update Product" : "Create Product"}
									</Button>
								</form>
							</DialogContent>
						</Dialog>
					</div>

					<Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Share Product</DialogTitle>
								<DialogDescription>
									Your product was created. Share it quickly on your social platforms.
								</DialogDescription>
							</DialogHeader>
							<div className="grid gap-3">
								<Button
									variant="outline"
									onClick={() =>
										recentlyCreatedProduct && shareProduct(recentlyCreatedProduct, "copy")
									}
								>
									<Copy className="mr-2 h-4 w-4" />
									Copy Product Link
								</Button>
								<Button
									variant="outline"
									onClick={() =>
										recentlyCreatedProduct &&
										shareProduct(recentlyCreatedProduct, "whatsapp")
									}
								>
									<MessageCircle className="mr-2 h-4 w-4" />
									Share to WhatsApp
								</Button>
								<Button
									variant="outline"
									onClick={() =>
										recentlyCreatedProduct &&
										shareProduct(recentlyCreatedProduct, "facebook")
									}
								>
									<Facebook className="mr-2 h-4 w-4" />
									Share to Facebook
								</Button>
								<Button
									variant="outline"
									onClick={() =>
										recentlyCreatedProduct && shareProduct(recentlyCreatedProduct, "x")
									}
								>
									<Twitter className="mr-2 h-4 w-4" />
									Share to X
								</Button>
								<Button
									variant="outline"
									onClick={() =>
										recentlyCreatedProduct &&
										shareProduct(recentlyCreatedProduct, "instagram")
									}
								>
									<Instagram className="mr-2 h-4 w-4" />
									Share to Instagram
								</Button>
							</div>
						</DialogContent>
					</Dialog>

					<div className="flex flex-col gap-4 sm:flex-row">
						<div className="relative flex-1">
							<HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search products..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="pl-9"
							/>
						</div>
						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger className="w-full sm:w-[180px]">
								<SelectValue placeholder="Filter by status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="pending">Pending</SelectItem>
								<SelectItem value="approved">Approved</SelectItem>
								<SelectItem value="rejected">Rejected</SelectItem>
							</SelectContent>
						</Select>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									disabled={selectedProductIds.length === 0}
								>
									<Share2 className="mr-2 h-4 w-4" />
									Share Selected ({selectedProductIds.length})
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onSelect={() => void shareSelectedProducts("copy")}>
									<Copy className="mr-2 h-4 w-4" />
									Copy all links
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => void shareSelectedProducts("whatsapp")}>
									<MessageCircle className="mr-2 h-4 w-4" />
									Share all to WhatsApp
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => void shareSelectedProducts("facebook")}>
									<Facebook className="mr-2 h-4 w-4" />
									Share all to Facebook
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => void shareSelectedProducts("x")}>
									<Twitter className="mr-2 h-4 w-4" />
									Share all to X
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => void shareSelectedProducts("instagram")}>
									<Instagram className="mr-2 h-4 w-4" />
									Share all to Instagram
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => void shareSelectedProducts("open_all")}>
									<ExternalLink className="mr-2 h-4 w-4" />
									Open all product pages
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
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
										<TableHead className="w-[44px]">
											<Checkbox
												checked={
													products.length > 0 &&
													products.every((p) => selectedProductIds.includes(p._id))
												}
												onCheckedChange={(checked) =>
													toggleSelectAllVisible(checked === true)
												}
												aria-label="Select all products"
											/>
										</TableHead>
										<TableHead>Product Name</TableHead>
										<TableHead>Type</TableHead>
										<TableHead>SKU</TableHead>
										<TableHead>Price</TableHead>
										<TableHead>Stock</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{products.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={8}
												className="text-center text-muted-foreground"
											>
												No products found. Create your first product to get
												started.
											</TableCell>
										</TableRow>
									) : (
										products.map((product) => (
											<TableRow key={product._id}>
												<TableCell>
													<Checkbox
														checked={selectedProductIds.includes(product._id)}
														onCheckedChange={(checked) =>
															toggleProductSelection(product._id, checked === true)
														}
														aria-label={`Select ${product.name}`}
													/>
												</TableCell>
												<TableCell className="font-medium">
													{product.name}
												</TableCell>
												<TableCell>
													{(() => {
														const serviceMeta =
															product.variants &&
															!Array.isArray(product.variants) &&
															typeof product.variants === "object" &&
															(product.variants as any).kind === "service"
																? (product.variants as any)
																: null;
														const isService =
															(product as any).productType === "service" || !!serviceMeta;
														return isService ? (
															<div className="space-y-1">
																<span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
																	Service
																</span>
																{serviceMeta?.duration ? (
																	<p className="text-xs text-muted-foreground">
																		{serviceMeta.duration}
																	</p>
																) : null}
															</div>
														) : (
															<span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
																Product
															</span>
														);
													})()}
												</TableCell>
												<TableCell className="font-mono text-sm">
													{product.sku}
												</TableCell>
												<TableCell>
													{(() => {
														const serviceMeta =
															product.variants &&
															!Array.isArray(product.variants) &&
															typeof product.variants === "object" &&
															(product.variants as any).kind === "service"
																? (product.variants as any)
																: null;
														const isService =
															(product as any).productType === "service" || !!serviceMeta;
														if (!isService) return `NGN ${product.price.toLocaleString()}`;
														const min = Number(serviceMeta?.priceMin ?? product.price);
														const max = Number(serviceMeta?.priceMax ?? product.price);
														return min === max
															? `NGN ${min.toLocaleString()}`
															: `NGN ${min.toLocaleString()} - NGN ${max.toLocaleString()}`;
													})()}
												</TableCell>
												<TableCell>{product.stock}</TableCell>
												<TableCell>
													<span
														className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
															product.status === "approved"
																? "bg-green-100 text-green-800"
																: product.status === "pending"
																? "bg-yellow-100 text-yellow-800"
																: "bg-red-100 text-red-800"
														}`}
													>
														{product.status}
													</span>
												</TableCell>
												<TableCell className="text-right">
													<div className="flex justify-end gap-2">
														<DropdownMenu>
															<DropdownMenuTrigger asChild>
																<Button variant="ghost" size="icon">
																	<Share2 className="h-4 w-4" />
																</Button>
															</DropdownMenuTrigger>
															<DropdownMenuContent align="end">
																<DropdownMenuItem
																	onSelect={() => void shareProduct(product, "copy")}
																>
																	<Copy className="mr-2 h-4 w-4" />
																	Copy link
																</DropdownMenuItem>
																<DropdownMenuItem
																	onSelect={() => void shareProduct(product, "whatsapp")}
																>
																	<MessageCircle className="mr-2 h-4 w-4" />
																	WhatsApp
																</DropdownMenuItem>
																<DropdownMenuItem
																	onSelect={() => void shareProduct(product, "facebook")}
																>
																	<Facebook className="mr-2 h-4 w-4" />
																	Facebook
																</DropdownMenuItem>
																<DropdownMenuItem
																	onSelect={() => void shareProduct(product, "x")}
																>
																	<Twitter className="mr-2 h-4 w-4" />
																	X (Twitter)
																</DropdownMenuItem>
																<DropdownMenuItem
																	onSelect={() => void shareProduct(product, "instagram")}
																>
																	<Instagram className="mr-2 h-4 w-4" />
																	Instagram
																</DropdownMenuItem>
																<DropdownMenuItem
																	onSelect={() => {
																		const url = getProductUrl(product);
																		if (!url) return;
																		window.open(url, "_blank", "noopener,noreferrer");
																	}}
																>
																	<ExternalLink className="mr-2 h-4 w-4" />
																	Open product page
																</DropdownMenuItem>
															</DropdownMenuContent>
														</DropdownMenu>
														<Button
															variant="ghost"
															size="icon"
															onClick={() => handleEdit(product)}
														>
															<HugeiconsIcon icon={PencilEdit02Icon} className="h-4 w-4" />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															onClick={() => handleDelete(product._id)}
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




