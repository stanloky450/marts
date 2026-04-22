"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { productService } from "@/lib/services/product.service"
import type { Product } from "@/lib/types"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, CheckmarkCircle02Icon, Cancel01Icon, ViewIcon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { Label } from "@/components/ui/label"

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("pending")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const getErrorMessage = (error: any, fallback: string) =>
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback

  const handleApprove = async (id: string) => {
    try {
      await productService.approve(id)
      toast.success("Product approved successfully")
      fetchProducts()
    } catch (error: any) {
      console.error("[v0] Failed to approve product:", error)
      toast.error(getErrorMessage(error, "Failed to approve product"))
    }
  }

  const handleReject = async () => {
    if (!selectedProduct || !rejectReason.trim()) {
      toast.error("Please provide a reason for rejection")
      return
    }

    setIsSubmitting(true)
    try {
      await productService.reject(selectedProduct._id, rejectReason)
      toast.success("Product rejected")
      setIsRejectDialogOpen(false)
      setRejectReason("")
      setSelectedProduct(null)
      fetchProducts()
    } catch (error: any) {
      console.error("[v0] Failed to reject product:", error)
      toast.error(getErrorMessage(error, "Failed to reject product"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const openRejectDialog = (product: Product) => {
    setSelectedProduct(product)
    setIsRejectDialogOpen(true)
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout userRole="admin">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Products</h1>
            <p className="text-muted-foreground">Review and manage products from your vendors</p>
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
                                  : "bg-red-100 text-red-800"
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
                                  onClick={() => openRejectDialog(product)}
                                  title="Reject"
                                >
                                  <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4 text-red-600" />
                                </Button>
                              </>
                            )}
                            <Button variant="ghost" size="icon" title="View Details">
                              <HugeiconsIcon icon={ViewIcon} className="h-4 w-4" />
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

          <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject Product</DialogTitle>
                <DialogDescription>Please provide a reason for rejecting "{selectedProduct?.name}"</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reason">Rejection Reason</Label>
                  <Textarea
                    id="reason"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Explain why this product is being rejected..."
                    rows={4}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleReject} disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
                    Reject Product
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
