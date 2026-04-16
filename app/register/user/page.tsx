"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { locationService, type Location } from "@/lib/services/location.service";
import { saveMarketUserRegistration } from "@/lib/market-user";

export default function RegisterUserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");

  const [isLoading, setIsLoading] = useState(false);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    region: "",
    area: "",
  });

  const selectedLocation = useMemo(
    () => locations.find((loc) => loc.region === form.region),
    [locations, form.region]
  );
  const areas = selectedLocation?.areas || [];

  useEffect(() => {
    const run = async () => {
      try {
        const response = await locationService.getLocations({ activeOnly: true });
        setLocations(response.data.data || []);
      } catch (error) {
        console.error("Failed to load locations", error);
        toast.error("Failed to load locations");
      } finally {
        setLocationsLoading(false);
      }
    };
    run();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.phoneNumber || !form.region || !form.area) {
      toast.error("Please complete all fields");
      return;
    }

    setIsLoading(true);
    try {
      saveMarketUserRegistration({
        id: `mu_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        ...form,
        registeredAt: new Date().toISOString(),
      });
      toast.success("Registration completed");
      router.push(nextPath || "/market");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40 p-4 py-12">
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Register as User</CardTitle>
            <CardDescription>
              Provide your details to continue to product details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="fullName">Name</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Your full name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  value={form.phoneNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="+234..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Region</Label>
                <Select
                  value={form.region}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, region: value, area: "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={locationsLoading ? "Loading..." : "Select region"} />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location._id} value={location.region}>
                        {location.region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Area</Label>
                <Select
                  value={form.area}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, area: value }))}
                  disabled={!form.region}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={!form.region ? "Select region first" : "Select area"} />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push("/register")}
                >
                  Back
                </Button>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Submitting..." : "Continue"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
