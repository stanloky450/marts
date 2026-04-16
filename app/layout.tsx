import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { CustomThemeProvider } from "@/contexts/theme-context";
import { Suspense } from "react";
import "./globals.css";

export const metadata: Metadata = {
	title: "Multi-Vendor E-Commerce Platform",
	description: "Your one-stop marketplace for all vendors",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" data-theme="black" suppressHydrationWarning>
			<body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
				<Suspense fallback={null}>
					<CustomThemeProvider>
						<AuthProvider>
							{children}
							<Toaster />
						</AuthProvider>
					</CustomThemeProvider>
				</Suspense>
				<Analytics />
			</body>
		</html>
	);
}

