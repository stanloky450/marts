"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { MarketUsersManager } from "@/components/dashboard/market-users-manager";

export default function SuperAdminUsersPage() {
  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <DashboardLayout>
        <MarketUsersManager scope="super_admin" />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
