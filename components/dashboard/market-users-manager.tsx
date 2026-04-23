"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, ShieldCheck, ShieldX } from "lucide-react";
import { marketUserService } from "@/lib/services/market-user.service";
import type { MarketUser } from "@/lib/types";
import { locationService, type Location } from "@/lib/services/location.service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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

interface MarketUsersManagerProps {
  scope: "admin" | "super_admin";
}

export function MarketUsersManager({ scope }: MarketUsersManagerProps) {
  const [users, setUsers] = useState<MarketUser[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "suspended">("all");
  const [region, setRegion] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isMutatingId, setIsMutatingId] = useState("");

  useEffect(() => {
    if (scope !== "super_admin") return;

    void (async () => {
      try {
        const response = await locationService.getLocations();
        setLocations(response.data.data || []);
      } catch {
        toast.error("Failed to load locations");
      }
    })();
  }, [scope]);

  useEffect(() => {
    let active = true;

    void (async () => {
      setIsLoading(true);
      try {
        const response = await marketUserService.getAll({
          search: search || undefined,
          status: status === "all" ? undefined : status,
          region: scope === "super_admin" && region !== "all" ? region : undefined,
          limit: 100,
        });
        if (!active) return;
        setUsers(response.data.data || []);
      } catch (error: any) {
        if (!active) return;
        toast.error(error?.response?.data?.error?.message || "Failed to load registered users");
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [region, scope, search, status]);

  const handleStatusChange = async (user: MarketUser, nextStatus: "active" | "suspended") => {
    setIsMutatingId(user._id);
    try {
      const response = await marketUserService.updateStatus(user._id, nextStatus);
      const updated = response.data.data;
      setUsers((current) => current.map((item) => (item._id === updated._id ? updated : item)));
      toast.success(
        nextStatus === "suspended" ? "User suspended successfully" : "User re-approved successfully"
      );
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || "Failed to update user");
    } finally {
      setIsMutatingId("");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Registered Users</h1>
        <p className="text-muted-foreground">
          {scope === "super_admin"
            ? "See all shopper registrations and moderate them by location."
            : "See shopper registrations in your assigned location and suspend or re-approve them."}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.4fr_0.7fr_0.9fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, phone, area, or region"
            className="pl-9"
          />
        </div>

        <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>

        {scope === "super_admin" ? (
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location._id} value={location.region}>
                  {location.region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            Scoped to your assigned region
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No registered users found for the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const isMutating = isMutatingId === user._id;
                  return (
                    <TableRow key={user._id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.fullName}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{user.phoneNumber}</TableCell>
                      <TableCell>
                        {user.area}, {user.region}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            user.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {user.status === "active" ? "Active" : "Suspended"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        {user.status === "active" ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isMutating}
                            onClick={() => void handleStatusChange(user, "suspended")}
                          >
                            {isMutating ? (
                              <Spinner className="mr-2 h-4 w-4" />
                            ) : (
                              <ShieldX className="mr-2 h-4 w-4" />
                            )}
                            Suspend
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isMutating}
                            onClick={() => void handleStatusChange(user, "active")}
                          >
                            {isMutating ? (
                              <Spinner className="mr-2 h-4 w-4" />
                            ) : (
                              <ShieldCheck className="mr-2 h-4 w-4" />
                            )}
                            Re-approve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
