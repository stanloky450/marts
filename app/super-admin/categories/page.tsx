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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	categoryService,
	type CreateCategoryData,
} from "@/lib/services/category.service";
import type { Category } from "@/lib/types";
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, PencilEdit02Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";

export default function CategoriesPage() {
	const [categories, setCategories] = useState<Category[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [editingCategory, setEditingCategory] = useState<Category | null>(null);

	const [formData, setFormData] = useState<CreateCategoryData>({
		name: "",
		slug: "",
		description: "",
		status: "active" as "active" | "inactive",
	});

	// ✅ Fetch Categories
	const fetchCategories = async () => {
		try {
			const response = await categoryService.getAll();
			// Your backend returns successResponse(categories)
			// Adjust to response.data.data or response.data based on actual structure
			setCategories(response.data.data || response.data);
		} catch (error) {
			console.error("[Categories] Fetch error:", error);
			toast.error("Failed to load categories");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchCategories();
	}, []);

	// ✅ Submit Create or Update
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);

		try {
			if (editingCategory) {
				await categoryService.update(editingCategory._id, formData);
				toast.success("Category updated successfully");
			} else {
				await categoryService.create(formData);
				toast.success("Category created successfully");
			}

			setIsDialogOpen(false);
			setEditingCategory(null);
			setFormData({ name: "", slug: "", description: "", status: "active" as "active" | "inactive" });
			fetchCategories();
		} catch (error) {
			console.error("[Categories] Save error:", error);
			toast.error("Failed to save category");
		} finally {
			setIsSubmitting(false);
		}
	};

	// ✅ Edit handler
	const handleEdit = (category: Category) => {
		setEditingCategory(category);
		setFormData({
			name: category.name,
			slug: category.slug,
			description: category.description || "",
			status: (category.status || "inactive") as "active" | "inactive",
		});
		setIsDialogOpen(true);
	};

	// ✅ Delete handler
	const handleDelete = async (id: string) => {
		if (!confirm("Are you sure you want to delete this category?")) return;

		try {
			await categoryService.delete(id);
			toast.success("Category deleted successfully");
			fetchCategories();
		} catch (error) {
			console.error("[Categories] Delete error:", error);
			toast.error("Failed to delete category");
		}
	};

	// ✅ Dialog close handler
	const handleDialogClose = (open: boolean) => {
		setIsDialogOpen(open);
		if (!open) {
			setEditingCategory(null);
			setFormData({ name: "", slug: "", description: "", status: "active" as "active" | "inactive" });
		}
	};

	return (
		<ProtectedRoute allowedRoles={["super_admin"]}>
			<DashboardLayout>
				<div className="space-y-6">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-3xl font-bold">Categories</h1>
							<p className="text-muted-foreground">Manage product categories</p>
						</div>

						{/* ✅ Dialog for create/edit */}
						<Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
							<DialogTrigger asChild>
								<Button>
									<HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
									Create Category
								</Button>
							</DialogTrigger>

							<DialogContent>
								<DialogHeader>
									<DialogTitle>
										{editingCategory ? "Edit Category" : "Create New Category"}
									</DialogTitle>
									<DialogDescription>
										{editingCategory
											? "Update existing category details."
											: "Add a new product category."}
									</DialogDescription>
								</DialogHeader>

								<form onSubmit={handleSubmit} className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="name">Name</Label>
										<Input
											id="name"
											value={formData.name}
											onChange={(e) =>
												setFormData({ ...formData, name: e.target.value })
											}
											required
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="slug">Slug</Label>
										<Input
											id="slug"
											value={formData.slug}
											onChange={(e) =>
												setFormData({ ...formData, slug: e.target.value })
											}
											placeholder="Leave empty to auto-generate"
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="description">Description</Label>
										<Textarea
											id="description"
											value={formData.description}
											onChange={(e) =>
												setFormData({
													...formData,
													description: e.target.value,
												})
											}
											rows={3}
										/>
									</div>

									<div className="flex items-center space-x-2">
										<Switch
											id="status"
											checked={formData.status === "active"}
											onCheckedChange={(checked) =>
												setFormData({
													...formData,
													status: checked ? "active" : "inactive",
												})
											}
										/>
										<Label htmlFor="status">Active</Label>
									</div>

									<Button
										type="submit"
										className="w-full"
										disabled={isSubmitting}
									>
										{isSubmitting && <Spinner className="mr-2 h-4 w-4" />}
										{editingCategory ? "Update Category" : "Create Category"}
									</Button>
								</form>
							</DialogContent>
						</Dialog>
					</div>

					{/* ✅ Table */}
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
										<TableHead>Slug</TableHead>
										<TableHead>Description</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{categories.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={5}
												className="text-center text-muted-foreground"
											>
												No categories found
											</TableCell>
										</TableRow>
									) : (
										categories.map((category) => (
											<TableRow key={category._id}>
												<TableCell>{category.name}</TableCell>
												<TableCell>{category.slug}</TableCell>
												<TableCell className="max-w-xs truncate">
													{category.description || "-"}
												</TableCell>
												<TableCell>
													<span
														className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
															category.status === "active"
																? "bg-green-100 text-green-800"
																: "bg-gray-100 text-gray-800"
														}`}
													>
														{category.status === "active"
															? "Active"
															: "Inactive"}
													</span>
												</TableCell>
												<TableCell className="text-right">
													<div className="flex justify-end gap-2">
														<Button
															variant="ghost"
															size="icon"
															onClick={() => handleEdit(category)}
														>
															<HugeiconsIcon icon={PencilEdit02Icon} className="h-4 w-4" />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															onClick={() => handleDelete(category._id)}
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


