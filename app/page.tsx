"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Store01Icon,
	UserGroupIcon,
	PackageIcon,
	// TrendingUpIcon,
	// Security01Icon,
	FlashIcon,
} from "@hugeicons/core-free-icons";

export default function HomePage() {
  return (
		<div className="min-h-screen bg-background">
			{/* Hero Section */}
			<section className="border-b bg-gradient-to-b from-muted/50 to-background">
				<div className="container mx-auto px-4 py-16 md:py-24">
					<div className="mx-auto max-w-3xl text-center">
						<h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
							Build Your Online Store with Ease
						</h1>
						<p className="mb-8 text-lg text-muted-foreground md:text-xl">
							Join our multi-vendor e-commerce platform and start selling your
							products online today. Powerful tools, seamless management, and
							unlimited potential.
						</p>
						<div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
							<Link href="/register">
								<Button size="lg" className="w-full sm:w-auto">
									<HugeiconsIcon icon={Store01Icon} className="mr-2 h-5 w-5" />
									Become a Vendor
								</Button>
							</Link>
							<Link href="/login">
								<Button
									size="lg"
									variant="outline"
									className="w-full sm:w-auto bg-transparent"
								>
									Sign In
								</Button>
							</Link>
						</div>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section className="py-16 md:py-24">
				<div className="container mx-auto px-4">
					<div className="mb-12 text-center">
						<h2 className="mb-4 text-3xl font-bold md:text-4xl">
							Why Choose Our Platform?
						</h2>
						<p className="text-lg text-muted-foreground">
							Everything you need to succeed online
						</p>
					</div>

					<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
						<Card>
							<CardHeader>
								<HugeiconsIcon
									icon={Store01Icon}
									className="mb-2 h-10 w-10 text-primary"
								/>
								<CardTitle>Your Own Storefront</CardTitle>
								<CardDescription>
									Get a custom subdomain and branded store for your business
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground">
									Create a unique online presence with your own customizable
									storefront that reflects your brand identity.
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<HugeiconsIcon
									icon={PackageIcon}
									className="mb-2 h-10 w-10 text-primary"
								/>
								<CardTitle>Product Management</CardTitle>
								<CardDescription>
									Easy-to-use tools for managing your inventory
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground">
									Add, edit, and organize your products with our intuitive
									dashboard. Track stock levels and manage categories
									effortlessly.
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<HugeiconsIcon
									icon={UserGroupIcon}
									className="mb-2 h-10 w-10 text-primary"
								/>
								<CardTitle>Admin Support</CardTitle>
								<CardDescription>
									Dedicated administrators to help you succeed
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground">
									Get assigned to dedicated admins who review your products and
									provide support throughout your selling journey.
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								{/* <HugeiconsIcon
									icon={Security01Icon}
									className="mb-2 h-10 w-10 text-primary"
								/> */}
								<CardTitle>Secure Platform</CardTitle>
								<CardDescription>
									Built with security and reliability in mind
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground">
									Your data and transactions are protected with
									industry-standard security measures and best practices.
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								{/* <HugeiconsIcon icon={TrendingUpIcon} className="mb-2 h-10 w-10 text-primary" /> */}
								<CardTitle>Grow Your Business</CardTitle>
								<CardDescription>
									Scale your operations with powerful analytics
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground">
									Track your performance, understand your customers, and make
									data-driven decisions to grow your business.
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<HugeiconsIcon
									icon={FlashIcon}
									className="mb-2 h-10 w-10 text-primary"
								/>
								<CardTitle>Quick Setup</CardTitle>
								<CardDescription>
									Get started in minutes, not days
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground">
									Simple registration process with referral code support. Start
									selling as soon as your account is approved.
								</p>
							</CardContent>
						</Card>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="border-t bg-muted/50 py-16 md:py-24">
				<div className="container mx-auto px-4">
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="mb-4 text-3xl font-bold md:text-4xl">
							Ready to Start Selling?
						</h2>
						<p className="mb-8 text-lg text-muted-foreground">
							Join hundreds of vendors already growing their business on our
							platform
						</p>
						<Link href="/register">
							<Button size="lg">
								<HugeiconsIcon icon={Store01Icon} className="mr-2 h-5 w-5" />
								Register as a Vendor
							</Button>
						</Link>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t py-8">
				<div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
					<p>© 2025 E-Commerce Platform. All rights reserved.</p>
				</div>
			</footer>
		</div>
	);
}
