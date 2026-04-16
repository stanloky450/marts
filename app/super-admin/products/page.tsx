"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { productService } from "@/lib/services/product.service"
import type { Product } from "@/lib/types"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, AccessIcon, Delete02Icon, CheckmarkCircle02Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const fetchProducts = async () => {
    try {
      const params: Record<string, string> = {}
      if (search) params.search = search
      if (statusFilter !== "all") params.status = statusFilter

      const response = await productService.getAll(params)
      setProducts(response.data.data)
    } catch (error) {
      console.error("[v0] Failed to fetch products:", error)
      toast.error("Failed to load products")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [search, statusFilter])

  const handleApprove = async (id: string) => {
    try {
      await productService.approve(id)
      toast.success("Product approved successfully")
      fetchProducts()
    } catch (error: any) {
      const message = error?.response?.data?.message || "Failed to approve product"
      console.error("[v0] Failed to approve product:", error)
      toast.error(message)
    }
  }

  const handleReject = async (id: string) => {
    const reason = prompt("Enter rejection reason (min 10 characters):")
    if (!reason) return
    try {
      await productService.reject(id, reason)
      toast.success("Product rejected successfully")
      fetchProducts()
    } catch (error: any) {
      const message = error?.response?.data?.message || "Failed to reject product"
      console.error("[v0] Failed to reject product:", error)
      toast.error(message)
    }
  }

  const handleSuspend = async (id: string) => {
    const reason = prompt("Enter reason for suspension:")
    if (!reason) return

    try {
      await productService.suspend(id, reason)
      toast.success("Product suspended successfully")
      fetchProducts()
    } catch (error) {
      console.error("[v0] Failed to suspend product:", error)
      toast.error("Failed to suspend product")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return

    try {
      await productService.delete(id)
      toast.success("Product deleted successfully")
      fetchProducts()
    } catch (error) {
      console.error("[v0] Failed to delete product:", error)
      toast.error("Failed to delete product")
    }
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">All Products</h1>
            <p className="text-muted-foreground">View and manage all products on the platform</p>
          </div>

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
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
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
                    <TableHead>Product Name</TableHead>
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
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No products found
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((product) => (
                      <TableRow key={product._id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                        <TableCell>₦{product.price.toLocaleString()}</TableCell>
                        <TableCell>{product.stock}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              product.status === "approved"
                                ? "bg-green-100 text-green-800"
                                : product.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : product.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {product.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {product.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleApprove(product._id)}
                                  title="Approve"
                                >
                                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleReject(product._id)}
                                  title="Reject"
                                >
                                  <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4 text-red-600" />
                                </Button>
                              </>
                            )}
                            {product.status === "approved" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleReject(product._id)}
                                title="Reject"
                              >
                                <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4 text-red-600" />
                              </Button>
                            )}
                            {product.status === "rejected" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleApprove(product._id)}
                                title="Approve"
                              >
                                <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            {product.status !== "suspended" && (
                              <Button variant="ghost" size="icon" onClick={() => handleSuspend(product._id)}>
                                <HugeiconsIcon icon={AccessIcon} className="h-4 w-4 text-orange-600" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(product._id)}>
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
  )
}
