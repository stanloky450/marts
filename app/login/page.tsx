"use client";

import type React from "react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { loginMarketUser } from "@/lib/market-user";
import { toast } from "sonner";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const nextPath = searchParams.get("next") || "";
  const encodedNext = useMemo(
    () => (nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""),
    [nextPath]
  );
  const [showPassword, setShowPassword] = useState(false);
  const [isVendorLoading, setIsVendorLoading] = useState(false);
  const [isUserLoading, setIsUserLoading] = useState(false);
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });
  const [userLoginData, setUserLoginData] = useState({
    email: "",
    phoneNumber: "",
  });

  const handleVendorLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsVendorLoading(true);

    try {
      await login(loginData.email, loginData.password);
    } catch (error) {
      console.error("[login] Login failed:", error);
    } finally {
      setIsVendorLoading(false);
    }
  };

  const handleUserLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsUserLoading(true);

    try {
      const marketUser = loginMarketUser(userLoginData.email, userLoginData.phoneNumber);
      if (!marketUser) {
        toast.error("No user account matched that email and phone number on this device");
        return;
      }

      toast.success("User login successful");
      router.push(nextPath || "/discover");
    } finally {
      setIsUserLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f7f1e7_0%,#ffffff_55%)] p-4">
      <Card className="w-full max-w-4xl overflow-hidden border-0 shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
        <div className="grid md:grid-cols-[1fr_1.05fr]">
          <div className="bg-slate-900 p-8 text-white">
            <p className="text-xs uppercase tracking-[0.35em] text-amber-300">Marketplace Access</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight">Login for both shoppers and vendors.</h1>
            <p className="mt-4 text-sm text-slate-300">
              Vendors, admins, and super-admins sign in with email and password. Marketplace users sign in with the email and phone number used during device registration.
            </p>
            <div className="mt-8 grid gap-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="font-semibold text-white">User flow</p>
                <p className="mt-1 text-sm text-slate-300">
                  Register once on this device, then return through user login to recover discover, account access, bookmarks, and vendor chat.
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="font-semibold text-white">Vendor flow</p>
                <p className="mt-1 text-sm text-slate-300">
                  Existing onboarding, payment verification, dashboard, and product management stay unchanged.
                </p>
              </div>
            </div>
          </div>

          <CardContent className="p-8">
            <Tabs defaultValue={mode === "user" ? "user" : "vendor"} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="user">User Login</TabsTrigger>
                <TabsTrigger value="vendor">Vendor Login</TabsTrigger>
              </TabsList>

              <TabsContent value="user">
                <CardHeader className="px-0">
                  <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
                  <CardDescription>
                    Sign in with the same email and phone number used when you registered on this device.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleUserLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="user-email"
                      type="email"
                      placeholder="you@example.com"
                      value={userLoginData.email}
                      onChange={(event) =>
                        setUserLoginData({ ...userLoginData, email: event.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone number</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      placeholder="+234..."
                      value={userLoginData.phoneNumber}
                      onChange={(event) =>
                        setUserLoginData({ ...userLoginData, phoneNumber: event.target.value })
                      }
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isUserLoading}>
                    {isUserLoading ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Opening account...
                      </>
                    ) : (
                      "User Login"
                    )}
                  </Button>
                  <p className="text-sm text-slate-500">
                    New here?{" "}
                    <Link href={`/register/user${encodedNext}`} className="font-semibold text-slate-900 underline">
                      Register as a user
                    </Link>
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="vendor">
                <CardHeader className="px-0">
                  <CardTitle className="text-2xl font-bold">Vendor and admin sign-in</CardTitle>
                  <CardDescription>Sign in to your dashboard with your account password.</CardDescription>
                </CardHeader>
                <form onSubmit={handleVendorLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vendor-email">Email</Label>
                    <Input
                      id="vendor-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginData.email}
                      onChange={(event) => setLoginData({ ...loginData, email: event.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendor-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="vendor-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={loginData.password}
                        onChange={(event) => setLoginData({ ...loginData, password: event.target.value })}
                        className="pr-11"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        <span className="text-xs font-semibold">{showPassword ? "Hide" : "Show"}</span>
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isVendorLoading}>
                    {isVendorLoading ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Signing in...
                      </>
                    ) : (
                      "Vendor Login"
                    )}
                  </Button>
                  <div className="rounded-2xl border p-5">
                    <p className="text-lg font-semibold">Need a vendor account?</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Continue with vendor onboarding, uploads, payment, and storefront setup.
                    </p>
                    <Link href={`/register/vendor${encodedNext}`} className="mt-4 block">
                      <Button variant="outline" className="w-full">
                        Continue as Vendor
                      </Button>
                    </Link>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
