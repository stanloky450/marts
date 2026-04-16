"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { vendorService } from "@/lib/services/vendor.service";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

export default function PaymentVerifyPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [status, setStatus] = useState<"loading" | "success" | "failed">(
		"loading"
	);
	const [message, setMessage] = useState("");

	useEffect(() => {
		const verifyPayment = async () => {
			const reference = searchParams.get("reference");

			if (!reference) {
				setStatus("failed");
				setMessage("No payment reference found");
				return;
			}

			try {
				const response = await vendorService.verifyPayment(reference);
				const { payment } = response.data.data;

				if (payment.status === "success") {
					setStatus("success");
					setMessage(
						"Payment successful! Your vendor account has been created. Please login to continue."
					);

					toast.success(
						"Registration completed successfully! Redirecting to login..."
					);

					// Redirect to login screen after 3 seconds
					setTimeout(() => {
						router.push("/login");
					}, 3000);
				} else {
					setStatus("failed");
					setMessage("Payment verification failed. Please contact support.");
				}
			} catch (error) {
				console.error("[v0] Payment verification error:", error);
				setStatus("failed");
				setMessage("Failed to verify payment. Please contact support.");
			}
		};

		verifyPayment();
	}, [searchParams, router]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
			<Card className="w-full max-w-md text-center">
				<CardHeader>
					{status === "loading" && (
						<>
							<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
								<Spinner className="h-12 w-12" />
							</div>
							<CardTitle>Verifying Payment</CardTitle>
							<CardDescription>
								Please wait while we confirm your payment...
							</CardDescription>
						</>
					)}

					{status === "success" && (
						<>
							<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
								<HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-12 w-12 text-green-600" />
							</div>
							<CardTitle className="text-green-600">
								Payment Successful!
							</CardTitle>
							<CardDescription>{message}</CardDescription>
						</>
					)}

					{status === "failed" && (
						<>
							<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
								<HugeiconsIcon icon={Cancel01Icon} className="h-12 w-12 text-red-600" />
							</div>
							<CardTitle className="text-red-600">Payment Failed</CardTitle>
							<CardDescription>{message}</CardDescription>
						</>
					)}
				</CardHeader>
				<CardContent>
					{status === "success" && (
						<p className="text-sm text-muted-foreground">
							Redirecting to login...
						</p>
					)}

					{status === "failed" && (
						<div className="space-y-2">
							<Button
								onClick={() => router.push("/register")}
								className="w-full"
							>
								Try Again
							</Button>
							<Button
								onClick={() => router.push("/")}
								variant="outline"
								className="w-full"
							>
								Go to Home
							</Button>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
