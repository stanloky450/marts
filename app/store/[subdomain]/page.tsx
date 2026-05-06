"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { storefrontService } from "@/lib/services/storefront.service";
import { categoryService } from "@/lib/services/category.service";
import type { Product, Vendor, Category } from "@/lib/types";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Search01Icon,
	Store01Icon,
	ShoppingCart01Icon,
	Location01Icon,
} from "@hugeicons/core-free-icons";
import {
	Copy,
	ChevronDown,
	ExternalLink,
	Facebook,
	Instagram,
	MessageCircle,
	Phone,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { AIChatWidget } from "@/components/ai-chat-widget";
import { getStorefrontThemeStyles } from "@/lib/storefront-theme";

const containerVariants = {
	hidden: { opacity: 0 },
	show: {
		opacity: 1,
		transition: {
			staggerChildren: 0.1,
		},
	},
};

const itemVariants = {
	hidden: { opacity: 0, y: 30 },
	show: {
		opacity: 1,
		y: 0,
		transition: { type: "spring" as const, stiffness: 300, damping: 24 },
	},
};

const heroVariants = {
	hidden: { opacity: 0, y: -20 },
	show: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.6, ease: "easeOut" as const },
	},
};

function ensureHttp(url: string) {
	return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function toWhatsAppUrl(value: string) {
	const digits = (value || "").replace(/[^\d]/g, "");
	return digits ? `https://wa.me/${digits}` : "";
}

function extractHandle(value?: string) {
	if (!value) return "";
	const trimmed = value.trim();
	if (!trimmed) return "";
	if (!trimmed.includes("/") && !trimmed.includes(".")) {
		return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
	}
	try {
		const url = new URL(ensureHttp(trimmed));
		const segments = url.pathname.split("/").filter(Boolean);
		const last = segments[segments.length - 1] || "";
		if (!last) return "";
		const clean = last.replace(/^@/, "").split("?")[0];
		return clean ? `@${clean}` : "";
	} catch {
		return "";
	}
}

function getServiceMeta(product: Product) {
	if (
		product.variants &&
		!Array.isArray(product.variants) &&
		typeof product.variants === "object" &&
		(product.variants as { kind?: string }).kind === "service"
	) {
		return product.variants as {
			duration?: string;
			priceMin?: number;
			priceMax?: number;
		};
	}
	return null;
}

function isServiceProduct(product: Product) {
	return product.productType === "service" || !!getServiceMeta(product);
}

export default function StorefrontPage() {
	const params = useParams();
	const subdomain = params.subdomain as string;

	const [vendor, setVendor] = useState<Vendor | null>(null);
	const [products, setProducts] = useState<Product[]>([]);
	const [categories, setCategories] = useState<Category[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<string>("all");
	const [sortBy, setSortBy] = useState<string>("name_asc");

	useEffect(() => {
		const fetchData = async () => {
			try {
				const [vendorRes, productsRes, categoriesRes] = await Promise.all([
					storefrontService.getVendorBySubdomain(subdomain),
					storefrontService.getVendorProducts(subdomain, {
						search,
						category: categoryFilter !== "all" ? categoryFilter : undefined,
						sortBy: sortBy as never,
					}),
					categoryService.getAll(),
				]);

				setVendor(vendorRes.data.data);
				setProducts(productsRes.data.data);
				setCategories(
					categoriesRes.data.data.filter((cat) => cat.status === "active")
				);
			} catch (error) {
				console.error("Failed to fetch storefront data:", error);
				toast.error("Failed to load store");
			} finally {
				setIsLoading(false);
			}
		};

		void fetchData();
	}, [subdomain, search, categoryFilter, sortBy]);

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Spinner className="h-8 w-8" />
			</div>
		);
	}

	if (!vendor) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center">
				<HugeiconsIcon
					icon={Store01Icon}
					className="mb-4 h-16 w-16 text-muted-foreground"
				/>
				<h1 className="text-2xl font-bold">Store Not Found</h1>
				<p className="text-muted-foreground">
					The store you're looking for doesn't exist.
				</p>
				<Link href="/">
					<Button className="mt-4">Go Home</Button>
				</Link>
			</div>
		);
	}

	const theme = getStorefrontThemeStyles(vendor.themeColor);
	const phoneValue = vendor.phone || vendor.phoneNumber;
	const whatsappValue =
		(vendor as Vendor & { whatsapp?: string }).whatsapp || vendor.whatsappNumber;
	const socialSource = (
		vendor as Vendor & {
			socials?: { facebook?: string; instagram?: string; x?: string; twitter?: string };
		}
	).socials;
	const socialMedia = vendor.socialMedia || {};
	const facebookUrl = socialSource?.facebook || socialMedia.facebook;
	const instagramUrl = socialSource?.instagram || socialMedia.instagram;
	const xUrl = socialSource?.x || socialSource?.twitter || socialMedia.twitter;

	const whatsappLink = whatsappValue ? toWhatsAppUrl(whatsappValue) : "";
	const facebookHandle = extractHandle(facebookUrl);
	const instagramHandle = extractHandle(instagramUrl);
	const xHandle = extractHandle(xUrl);

	const socialLinks = [
		facebookUrl
			? {
					key: "facebook",
					label: "Facebook",
					url: ensureHttp(facebookUrl),
					handle: facebookHandle,
					icon: <Facebook className="h-4 w-4" />,
			  }
			: null,
		instagramUrl
			? {
					key: "instagram",
					label: "Instagram",
					url: ensureHttp(instagramUrl),
					handle: instagramHandle,
					icon: <Instagram className="h-4 w-4" />,
			  }
			: null,
		xUrl
			? {
					key: "x",
					label: "X (Twitter)",
					url: ensureHttp(xUrl),
					handle: xHandle,
					icon: (
						<span className="inline-flex h-4 w-4 items-center justify-center text-xs font-bold">
							X
						</span>
					),
			  }
			: null,
	].filter(Boolean) as Array<{
		key: string;
		label: string;
		url: string;
		handle: string;
		icon: ReactNode;
	}>;

	const copyText = async (value: string, label: string) => {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(`${label} copied`);
		} catch {
			toast.error(`Failed to copy ${label.toLowerCase()}`);
		}
	};

	return (
		<>
			<div className="min-h-screen" style={{ background: theme.pageBackground }}>
				<motion.header
					variants={heroVariants}
					initial="hidden"
					animate="show"
					className="relative flex flex-col items-center justify-center overflow-hidden py-24 text-center"
					style={vendor.bannerImage ? undefined : { background: theme.heroBackground }}
				>
					{vendor.bannerImage && (
						<div className="absolute inset-0 z-0">
							<img
								src={vendor.bannerImage}
								alt={`${vendor.businessName} banner`}
								className="h-full w-full object-cover"
							/>
							<div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30" />
						</div>
					)}

					<div className="container relative z-10 mx-auto px-4 text-white">
						<motion.div
							initial={{ scale: 0.9, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							transition={{ delay: 0.2 }}
							className="mb-6 flex justify-center"
						>
							{vendor.logoUrl ? (
								<img
									src={vendor.logoUrl}
									alt="Logo"
									className="h-28 w-28 rounded-full border-4 border-white/20 object-cover shadow-2xl"
								/>
							) : (
								<div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-white/20 bg-white/10 text-white shadow-2xl backdrop-blur-md">
									<HugeiconsIcon icon={Store01Icon} className="h-12 w-12" />
								</div>
							)}
						</motion.div>

						<motion.div
							initial={{ y: 20, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							transition={{ delay: 0.3 }}
						>
							<h1 className="mb-4 text-4xl font-extrabold tracking-tight drop-shadow-lg md:text-6xl">
								{vendor.businessName}
							</h1>
							<p className="mx-auto max-w-2xl text-lg font-medium leading-relaxed text-white/90 drop-shadow-md md:text-xl">
								{vendor.description ||
									"Welcome to our store. Browse our latest products below."}
							</p>

							<div className="mx-auto mt-8 max-w-5xl rounded-2xl border border-white/20 bg-black/25 p-4 backdrop-blur-md">
								<div className="mb-3 text-sm font-semibold tracking-wide text-white/90">
									Connect & Contact
								</div>
								<div className="grid gap-3 md:grid-cols-2">
									{whatsappLink && (
										<div className="md:col-span-2">
											<a href={whatsappLink} target="_blank" rel="noreferrer">
												<Button
													className="h-10 rounded-xl px-4 shadow-sm"
													style={{
														background: theme.theme.accent,
														color: theme.buttonText,
													}}
												>
													<MessageCircle className="mr-2 h-4 w-4" />
													Chat on WhatsApp
												</Button>
											</a>
										</div>
									)}

									{vendor.address?.city && (
										<div className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm text-white">
											<span className="flex items-center gap-2">
												<HugeiconsIcon icon={Location01Icon} className="h-4 w-4" />
												{vendor.address.city}
												{vendor.address.country ? `, ${vendor.address.country}` : ""}
											</span>
										</div>
									)}

									{phoneValue && (
										<div className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm text-white">
											<span className="flex items-center gap-2">
												<Phone className="h-4 w-4" />
												{phoneValue}
											</span>
											<Button
												size="icon"
												variant="ghost"
												className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
												onClick={() => copyText(phoneValue, "Phone number")}
											>
												<Copy className="h-4 w-4" />
											</Button>
										</div>
									)}

									{whatsappValue && (
										<div className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm text-white">
											<span className="flex items-center gap-2">
												<MessageCircle className="h-4 w-4" />
												{whatsappValue}
											</span>
											<Button
												size="icon"
												variant="ghost"
												className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
												onClick={() => copyText(whatsappValue, "WhatsApp number")}
											>
												<Copy className="h-4 w-4" />
											</Button>
										</div>
									)}

									{socialLinks.length > 0 && (
										<div className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white">
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														className="h-9 w-full justify-between px-2 text-white hover:bg-white/20 hover:text-white"
													>
														<span>Connect via Social</span>
														<ChevronDown className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="start" className="w-64">
													{socialLinks.map((social) => (
														<DropdownMenuItem
															key={social.key}
															onSelect={() =>
																window.open(social.url, "_blank", "noopener,noreferrer")
															}
															className="flex items-center justify-between gap-2"
														>
															<span className="flex items-center gap-2">
																{social.icon}
																<span>{social.label}</span>
																{social.handle ? (
																	<span className="text-muted-foreground">
																		{social.handle}
																	</span>
																) : null}
															</span>
															<span className="flex items-center gap-2">
																<Button
																	type="button"
																	size="icon"
																	variant="ghost"
																	className="h-7 w-7"
																	onClick={(e) => {
																		e.preventDefault();
																		e.stopPropagation();
																		void copyText(social.url, `${social.label} link`);
																	}}
																>
																	<Copy className="h-4 w-4" />
																</Button>
																<ExternalLink className="h-3 w-3 text-muted-foreground" />
															</span>
														</DropdownMenuItem>
													))}
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									)}

								</div>
							</div>
						</motion.div>
					</div>
				</motion.header>

				<main
					className="container relative z-20 mx-auto min-h-[50vh] rounded-t-[2.2rem] px-4 py-14 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]"
					style={{ background: theme.pageBackground }}
				>
					<div className="mb-8 flex items-center justify-between">
						<h2 className="text-2xl font-bold tracking-tight" style={{ color: theme.theme.text }}>
							Our Products
						</h2>
						<Link href="/">
							<Button
								variant="outline"
								className="rounded-full border-2 bg-white/50 shadow-sm backdrop-blur-sm hover:bg-white"
								style={{ borderColor: theme.strongBorder, color: theme.theme.text }}
							>
								Back to Marketplace
							</Button>
						</Link>
					</div>

					<div className="mb-10 space-y-4">
						<div className="flex flex-col gap-4 md:flex-row">
							<div className="relative flex-1">
								<HugeiconsIcon
									icon={Search01Icon}
									className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
									style={{ color: theme.theme.text }}
								/>
								<Input
									placeholder="Search products..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="rounded-xl border-transparent bg-white/60 pl-9 shadow-sm backdrop-blur-sm transition-all focus-visible:border-transparent focus-visible:bg-white"
									style={{ color: theme.theme.text }}
								/>
							</div>

							<Select value={categoryFilter} onValueChange={setCategoryFilter}>
								<SelectTrigger
									className="w-full rounded-xl border-transparent bg-white/60 shadow-sm backdrop-blur-sm transition-all focus:bg-white md:w-[200px]"
									style={{ color: theme.theme.text }}
								>
									<SelectValue placeholder="Category" />
								</SelectTrigger>
								<SelectContent className="rounded-xl">
									<SelectItem value="all">All Categories</SelectItem>
									{categories.map((category) => (
										<SelectItem key={category._id} value={category._id}>
											{category.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Select value={sortBy} onValueChange={setSortBy}>
								<SelectTrigger
									className="w-full rounded-xl border-transparent bg-white/60 shadow-sm backdrop-blur-sm transition-all focus:bg-white md:w-[200px]"
									style={{ color: theme.theme.text }}
								>
									<SelectValue placeholder="Sort by" />
								</SelectTrigger>
								<SelectContent className="rounded-xl">
									<SelectItem value="name_asc">Name (A-Z)</SelectItem>
									<SelectItem value="name_desc">Name (Z-A)</SelectItem>
									<SelectItem value="price_asc">Price (Low to High)</SelectItem>
									<SelectItem value="price_desc">Price (High to Low)</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{products.length === 0 ? (
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							className="flex flex-col items-center justify-center rounded-2xl border border-white/60 bg-white/50 p-16 text-center shadow-sm backdrop-blur-md"
						>
							<HugeiconsIcon
								icon={ShoppingCart01Icon}
								className="mb-4 h-16 w-16 opacity-40"
								style={{ color: theme.theme.text }}
							/>
							<h2 className="text-xl font-semibold" style={{ color: theme.theme.text }}>
								No Products Found
							</h2>
							<p className="mt-2 text-muted-foreground">
								This store doesn&apos;t have any products matching your criteria.
							</p>
						</motion.div>
					) : (
						<motion.div
							variants={containerVariants}
							initial="hidden"
							animate="show"
							className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
						>
							{products.map((product) => (
								<motion.div key={product._id} variants={itemVariants} className="h-full">
									<Link
										href={`/store/${subdomain}/products/${product._id}`}
										className="block h-full rounded-2xl outline-none"
									>
										<Card className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/40 bg-white/80 backdrop-blur-md transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]">
											<CardHeader className="p-0">
												<div className="relative aspect-square w-full overflow-hidden bg-muted/30">
													<img
														src={
															product.images?.[0] ||
															"/placeholder.svg?height=300&width=300&query=product"
														}
														alt={product.name}
														className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
													/>
													<div
														className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 backdrop-blur-[2px] group-hover:opacity-100"
														style={{ background: theme.shadow }}
													>
														<span
															className="rounded-full px-6 py-2.5 text-sm font-bold shadow-xl transition-transform hover:scale-105"
															style={{
																background: theme.theme.accent,
																color: theme.buttonText,
															}}
														>
															View Details
														</span>
													</div>
												</div>
											</CardHeader>

											<CardContent className="flex flex-1 flex-col p-3">
												<div className="mb-2">
													<span
														className="inline-flex rounded-full px-2 py-1 text-[11px] font-semibold"
														style={{
															background: isServiceProduct(product)
																? theme.theme.accent
																: theme.panelBackground,
															color: theme.buttonText,
														}}
													>
														{isServiceProduct(product) ? "Service" : "Product"}
													</span>
												</div>

												<CardTitle
													className="mb-2 line-clamp-2 text-lg font-bold transition-colors group-hover:opacity-80"
													style={{ color: theme.theme.text }}
												>
													{product.name}
												</CardTitle>
												<p className="line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
													{product.description}
												</p>
											</CardContent>

											<CardFooter className="flex items-center justify-between border-t border-black/5 bg-black/[0.02] p-3">
												{(() => {
													const serviceMeta = getServiceMeta(product);
													if (isServiceProduct(product)) {
														const min = Number(serviceMeta?.priceMin ?? product.price);
														const max = Number(serviceMeta?.priceMax ?? product.price);
														return (
															<>
																<span
																	className="text-xl font-black"
																	style={{ color: theme.theme.text }}
																>
																	{min === max
																		? `NGN ${min.toLocaleString()}`
																		: `NGN ${min.toLocaleString()} - NGN ${max.toLocaleString()}`}
																</span>
																<span
																	className="rounded-full border px-3 py-1 text-xs font-semibold shadow-sm"
																	style={{
																		background: theme.panelBackground,
																		borderColor: theme.strongBorder,
																		color: theme.theme.text,
																	}}
																>
																	{serviceMeta?.duration || "Service"}
																</span>
															</>
														);
													}

													return (
														<>
															<span
																className="text-2xl font-black"
																style={{ color: theme.theme.text }}
															>
																NGN {product.price.toLocaleString()}
															</span>
															<span
																className="rounded-full border px-3 py-1 text-xs font-semibold shadow-sm"
																style={{
																	background: theme.panelBackground,
																	borderColor: theme.strongBorder,
																	color: theme.theme.text,
																}}
															>
																{product.stock} left
															</span>
														</>
													);
												})()}
											</CardFooter>
										</Card>
									</Link>
								</motion.div>
							))}
						</motion.div>
					)}
				</main>

				<footer
					className="mt-0 border-t py-16"
					style={{ borderColor: theme.softBorder, background: theme.theme.accent }}
				>
					<div className="container mx-auto px-4 text-center">
						<div
							className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
							style={{ background: theme.panelBackground }}
						>
							<HugeiconsIcon
								icon={Store01Icon}
								className="h-8 w-8"
								style={{ color: theme.theme.text }}
							/>
						</div>
						<h3 className="mb-2 text-xl font-bold" style={{ color: theme.theme.text }}>
							{vendor.businessName}
						</h3>
						<p className="mb-8 text-sm" style={{ color: theme.mutedText }}>
							Thanks for shopping with us!
						</p>

						<div className="flex justify-center gap-6 text-sm" style={{ color: theme.mutedText }}>
							<p className="font-medium">© 2025 All rights reserved.</p>
							{vendor.phoneNumber && (
								<>
									<span className="opacity-30">•</span>
									<p>Contact: {vendor.phoneNumber}</p>
								</>
							)}
						</div>
					</div>
				</footer>
			</div>

			<AIChatWidget
				subdomain={subdomain}
				storeContext={
					vendor.description
						? `${vendor.businessName}: ${vendor.description}`
						: vendor.businessName
				}
			/>
		</>
	);
}
