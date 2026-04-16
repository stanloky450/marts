"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiClient } from "@/lib/api-client"
import type { ApiResponse, Vendor } from "@/lib/types"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Link02Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")

  const fetchVendors = async () => {
    try {
      const params: Record<string, string> = {}
      if (search) params.search = search

      const response = await apiClient.get<ApiResponse<Vendor[]>>("/admins/me/vendors", { params })
      setVendors(response.data.data)
    } catch (error) {
      console.error("[v0] Failed to fetch vendors:", error)
      toast.error("Failed to load vendors")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchVendors()
  }, [search])

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout userRole="admin">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">My Vendors</h1>
            <p className="text-muted-foreground">Vendors assigned to you</p>
          </div>

          <div className="relative">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
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
                    <TableHead>Business Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Subdomain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No vendors assigned to you yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    vendors.map((vendor) => (
                      <TableRow key={vendor._id}>
                        <TableCell className="font-medium">{vendor.businessName}</TableCell>
                        <TableCell>{vendor.phoneNumber}</TableCell>
                        <TableCell className="font-mono text-sm">{vendor.subdomain || "-"}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              vendor.isApproved ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {vendor.isApproved ? "Approved" : "Pending"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              vendor.isPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}
                          >
                            {vendor.isPaid ? "Paid" : "Unpaid"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {vendor.subdomain && (
                            <Link href={`/store/${vendor.subdomain}`} target="_blank">
                              <Button variant="ghost" size="icon">
                                <HugeiconsIcon icon={Link02Icon} className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
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
