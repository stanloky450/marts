"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  locationService,
  type Location,
  type NigeriaCatalogRegion,
} from "@/lib/services/location.service";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  PencilEdit02Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";

type LocationSource = "nigeria_catalog" | "custom";

export default function LocationsSettingsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [catalog, setCatalog] = useState<NigeriaCatalogRegion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    source: "nigeria_catalog" as LocationSource,
    catalogState: "",
    region: "",
    areaSearch: "",
    areas: "",
    registrationFee: 10000,
    isActive: true,
  });

  const selectedCatalogState = useMemo(
    () => catalog.find((entry) => entry.state === formData.catalogState),
    [catalog, formData.catalogState]
  );

  const filteredLocalGovernments = useMemo(() => {
    const all = selectedCatalogState?.localGovernments || [];
    const query = formData.areaSearch.trim().toLowerCase();
    if (!query) return all;
    return all.filter((lga) => lga.toLowerCase().includes(query));
  }, [selectedCatalogState, formData.areaSearch]);

  const suggestedAreas = useMemo(() => {
    if (!formData.region) return [];
    const found = locations.find(
      (loc) => loc.region.toLowerCase() === formData.region.toLowerCase()
    );
    return found?.areas || [];
  }, [locations, formData.region]);

  const fetchLocations = async () => {
    setIsLoading(true);
    try {
      const response = await locationService.getLocations();
      setLocations(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch locations", error);
      toast.error("Failed to load locations");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCatalog = async () => {
    setIsCatalogLoading(true);
    try {
      const response = await locationService.getNigeriaCatalog();
      setCatalog(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch Nigeria location catalog", error);
      toast.error("Failed to load Nigeria states/LGAs catalog");
    } finally {
      setIsCatalogLoading(false);
    }
  };

  useEffect(() => {
    void fetchLocations();
    void fetchCatalog();
  }, []);

  const resetForm = () => {
    setFormData({
      source: "nigeria_catalog",
      catalogState: "",
      region: "",
      areaSearch: "",
      areas: "",
      registrationFee: 10000,
      isActive: true,
    });
    setEditingLocation(null);
  };

  const handleOpenDialog = (loc?: Location) => {
    if (loc) {
      setEditingLocation(loc);
      setFormData({
        source: "custom",
        catalogState: "",
        region: loc.region,
        areaSearch: "",
        areas: loc.areas.join(", "),
        registrationFee: loc.registrationFee,
        isActive: loc.isActive,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const appendSuggestedArea = (area: string) => {
    const current = formData.areas
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    if (current.some((a) => a.toLowerCase() === area.toLowerCase())) return;
    const next = [...current, area];
    setFormData((prev) => ({ ...prev, areas: next.join(", ") }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.region.trim()) {
      toast.error("Region is required");
      return;
    }

    const areasArray = formData.areas
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    if (areasArray.length === 0) {
      toast.error("At least one Area is required");
      return;
    }

    if (formData.source === "nigeria_catalog" && !formData.catalogState) {
      toast.error("State is required for Nigeria catalog mode");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        source: formData.source,
        state: formData.source === "nigeria_catalog" ? formData.catalogState : undefined,
        region: formData.region,
        areas: areasArray,
        registrationFee: Number(formData.registrationFee),
        isActive: formData.isActive,
      };

      if (editingLocation) {
        await locationService.updateLocation(editingLocation._id, payload);
        toast.success("Location updated successfully");
      } else {
        await locationService.createLocation(payload);
        toast.success("Location created successfully");
      }

      setIsDialogOpen(false);
      resetForm();
      await fetchLocations();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Something went wrong"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this location?")) return;
    try {
      await locationService.deleteLocation(id);
      toast.success("Location deleted successfully");
      await fetchLocations();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete location");
    }
  };

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Locations & Pricing</h1>
              <p className="text-muted-foreground">
                Region is Local Government. Area is popular place within the Local
                Government.
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
                  Add Location
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingLocation ? "Edit Location" : "Add Location"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Source</Label>
                    <Select
                      value={formData.source}
                      onValueChange={(value: LocationSource) =>
                        setFormData((prev) => ({
                          ...prev,
                          source: value,
                          catalogState: "",
                          region: "",
                          areaSearch: "",
                          areas: "",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nigeria_catalog">
                          Nigeria States + Local Governments
                        </SelectItem>
                        <SelectItem value="custom">Custom Input</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.source === "nigeria_catalog" ? (
                    <>
                      <div className="space-y-2">
                        <Label>State</Label>
                        <Select
                          value={formData.catalogState}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              catalogState: value,
                              region: "",
                              areaSearch: "",
                            }))
                          }
                          disabled={isCatalogLoading}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                isCatalogLoading ? "Loading states..." : "Select state"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {catalog.map((entry) => (
                              <SelectItem key={entry.state} value={entry.state}>
                                {entry.state} ({entry.localGovernmentCount} LGAs)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Region (Local Government)</Label>
                        <Input
                          placeholder="Search LGA..."
                          value={formData.areaSearch}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              areaSearch: e.target.value,
                            }))
                          }
                          disabled={!formData.catalogState}
                        />
                        <Select
                          value={formData.region}
                          onValueChange={(value) =>
                            setFormData((prev) => ({ ...prev, region: value }))
                          }
                          disabled={!formData.catalogState}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                !formData.catalogState
                                  ? "Select state first"
                                  : "Select Local Government"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredLocalGovernments.map((lga) => (
                              <SelectItem key={lga} value={lga}>
                                {lga}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <Label>Region (Local Government)</Label>
                      <Input
                        value={formData.region}
                        onChange={(e) =>
                          setFormData({ ...formData, region: e.target.value })
                        }
                        placeholder="e.g. Ikeja"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Areas (popular places, comma-separated)</Label>
                    <Input
                      value={formData.areas}
                      onChange={(e) =>
                        setFormData({ ...formData, areas: e.target.value })
                      }
                      placeholder="Alausa, Computer Village, Opebi"
                    />
                    {suggestedAreas.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {suggestedAreas.map((area) => (
                          <Button
                            key={area}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => appendSuggestedArea(area)}
                          >
                            {area}
                          </Button>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      You can type any area manually if it is not listed.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Registration Fee (NGN)</Label>
                    <Input
                      type="number"
                      value={formData.registrationFee}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          registrationFee: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label>Active Status</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable or disable registration for this location
                      </p>
                    </div>
                    <Switch
                      checked={formData.isActive}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isActive: checked })
                      }
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Spinner className="mr-2 h-4 w-4" />
                          Saving...
                        </>
                      ) : (
                        "Save Location"
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-8 w-8" />
            </div>
          ) : (
            <div className="rounded-md border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Region (LGA)</TableHead>
                    <TableHead>Areas Count</TableHead>
                    <TableHead>Fee (NGN)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No locations configured.
                      </TableCell>
                    </TableRow>
                  ) : (
                    locations.map((loc) => (
                      <TableRow key={loc._id}>
                        <TableCell className="font-medium">{loc.region}</TableCell>
                        <TableCell>
                          <span title={loc.areas.join(", ")}>{loc.areas.length} areas</span>
                        </TableCell>
                        <TableCell>NGN {(loc.registrationFee || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              loc.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {loc.isActive ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(loc)}
                          >
                            <HugeiconsIcon icon={PencilEdit02Icon} className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(loc._id)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" />
                          </Button>
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
