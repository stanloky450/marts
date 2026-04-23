"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { MarketUsersManager } from "@/components/dashboard/market-users-manager";

export default function AdminUsersPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout userRole="admin">
        <MarketUsersManager scope="admin" />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
