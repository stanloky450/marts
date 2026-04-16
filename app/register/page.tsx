"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterChooserPage() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "";
  const encodedNext = useMemo(
    () => (nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""),
    [nextPath]
  );

  return (
    <div className="min-h-screen bg-muted/40 p-4 py-12">
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Register</CardTitle>
            <CardDescription>
              Choose how you want to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Card className="border-2">
              <CardHeader>
                <CardTitle>Register as User</CardTitle>
                <CardDescription>
                  Create a shopper profile to continue viewing product details.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={`/register/user${encodedNext}`}>
                  <Button className="w-full">Continue as User</Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <CardTitle>Register as Vendor</CardTitle>
                <CardDescription>
                  Keep using the vendor onboarding and payment flow.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={`/register/vendor${encodedNext}`}>
                  <Button className="w-full" variant="outline">
                    Continue as Vendor
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
