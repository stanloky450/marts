"use client";

import type React from "react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";

export default function LoginPage() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const nextPath = searchParams.get("next") || "";
  const encodedNext = useMemo(
    () => (nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""),
    [nextPath]
  );
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      await login(loginData.email, loginData.password);
    } catch (error) {
      console.error("[login] Login failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f7f1e7_0%,#ffffff_55%)] p-4">
      <Card className="w-full max-w-4xl overflow-hidden border-0 shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
        <div className="grid md:grid-cols-[1fr_1.05fr]">
          <div className="bg-slate-900 p-8 text-white">
            <p className="text-xs uppercase tracking-[0.35em] text-amber-300">Marketplace Access</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight">Login for vendors. Register for users.</h1>
            <p className="mt-4 text-sm text-slate-300">
              Vendor, admin, and super-admin accounts sign in here. Marketplace users use the user registration flow, which creates their discover and account experience.
            </p>
            <div className="mt-8 grid gap-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="font-semibold text-white">User flow</p>
                <p className="mt-1 text-sm text-slate-300">
                  Multi-step registration, location-based discover, bookmarks, viewed products, and chat with vendors.
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
            <Tabs defaultValue={mode === "user" ? "register" : "login"} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Vendor Login</TabsTrigger>
                <TabsTrigger value="register">User Access</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <CardHeader className="px-0">
                  <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
                  <CardDescription>Sign in to your account to continue</CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginData.email}
                      onChange={(event) => setLoginData({ ...loginData, email: event.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
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
                        <span className="text-xs font-semibold">
                          {showPassword ? "Hide" : "Show"}
                        </span>
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <CardHeader className="px-0">
                  <CardTitle className="text-2xl font-bold">Choose how to continue</CardTitle>
                  <CardDescription>
                    Users and vendors now have separate registration experiences.
                  </CardDescription>
                </CardHeader>
                <div className="grid gap-4">
                  <div className="rounded-2xl border p-5">
                    <p className="text-lg font-semibold">Register as User</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Create your location-aware marketplace account, unlock discover, bookmark products, and chat with vendors.
                    </p>
                    <Link href={`/register/user${encodedNext}`} className="mt-4 block">
                      <Button className="w-full">Continue as User</Button>
                    </Link>
                  </div>
                  <div className="rounded-2xl border p-5">
                    <p className="text-lg font-semibold">Register as Vendor</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Continue with vendor onboarding, uploads, payment, and storefront setup.
                    </p>
                    <Link href={`/register/vendor${encodedNext}`} className="mt-4 block">
                      <Button variant="outline" className="w-full">
                        Continue as Vendor
                      </Button>
                    </Link>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
