"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { settingService } from "@/lib/services/setting.service";
import { ProductCard } from "@/components/product-card";
import { apiClient } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";
import type { Product, Vendor, ApiResponse } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { storefrontService } from "@/lib/services/storefront.service";
import { MarketHeader } from "@/components/market-header";

// Simple UI data for categories
const CATEGORIES = [
	{ name: "Women", image: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=400&h=300&fit=crop" },
	{ name: "Men's fashion", image: "https://images.unsplash.com/photo-1594938298595-5858e0a8ad1f?w=400&h=300&fit=crop" },
	{ name: "Children", image: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&h=300&fit=crop" },
	{ name: "Electronics", image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=300&fit=crop" },
];

export default function MarketPage() {
	const [isLoading, setIsLoading] = useState(true);
	const [bannerUrl, setBannerUrl] = useState<string>("");
	const [rssUrl, setRssUrl] = useState<string>("");
	const [rssCount, setRssCount] = useState<number>(5);
	const [rssItems, setRssItems] = useState<any[]>([]);

	const [flashSales, setFlashSales] = useState<Product[]>([]);
	const [skilledWorkers, setSkilledWorkers] = useState<Product[]>([]);
	const [vendors, setVendors] = useState<Vendor[]>([]);
	const [ads, setAds] = useState<any[]>([]);

	useEffect(() => {
		const fetchMarketData = async () => {
			setIsLoading(true);
			try {
				// 1. Fetch public settings (banner + rss config)
				const settingsRes = await settingService.getPublicSettings();
				const s = settingsRes.data.data;
				console.log("Market settings fetched:", s);
				setBannerUrl(s.market_banner_url || "");
				setRssUrl(s.market_rss_url || "");
				setRssCount(Number(s.market_rss_ad_count) || 5);

				// 2. Public products for flash sales / latest arrivals
				const productsRes = await storefrontService.getNewArrivals(4);
				setFlashSales((productsRes.data.data || []).slice(0, 4));

				// 3. Public products for skilled workers / featured
				const skilledRes = await storefrontService.getFeaturedProducts(4);
				setSkilledWorkers((skilledRes.data.data || []).slice(0, 4));

				// 4. Public active vendors for spotlight
				const vendorRes = await storefrontService.getStores({ limit: 6 });
				setVendors(vendorRes.data.data || []);

				// 5. Fetch Ads
				try {
					const adsRes = await apiClient.get<ApiResponse<any[]>>("/adsplace");
					// @ts-ignore
					setAds(adsRes.data.data.filter(ad => ad.active !== false));
				} catch (err) {
					console.error("Ads fetch error:", err);
				}

				// 6. Fetch RSS if configured
				if (s.market_rss_url) {
					console.log("Attempting to fetch RSS via proxy for:", s.market_rss_url);
					settingService.getRssProxy(s.market_rss_url)
						.then((res) => {
							const data = res.data.data;
							console.log("RSS Proxy response:", data);
							if (!data || !data.items) throw new Error("Invalid or empty response from proxy");
							
							const items = data.items.slice(0, Number(s.market_rss_ad_count) || 5).map((el: any) => ({
								title: el.title || "No Title",
								link: el.link || "#",
								description: (el.description || "").substring(0, 100) + ((el.description || "").length > 100 ? "..." : ""),
							}));
							setRssItems(items);
						})
						.catch(e => {
							console.error("RSS fetch error detail:", e);
						});
				} else {
					console.log("No RSS URL configured in settings");
				}
			} catch (error) {
				console.error("Failed to load market data", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchMarketData();
	}, []);

	return (
		<div className="min-h-screen bg-slate-50 flex flex-col">
			<MarketHeader current="market" />

			{/* Search Bar */}
			<div className="bg-white px-4 py-6 md:px-8 border-b">
				<div className="max-w-3xl mx-auto relative">
					<Input
						placeholder="What do you need?"
						className="pl-4 pr-12 py-6 rounded-full border-2 border-primary/20 bg-primary/5 text-lg w-full"
					/>
					<div className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-2 bg-white">
						<HugeiconsIcon icon={Search01Icon} className="h-5 w-5 text-muted-foreground" />
					</div>
				</div>
			</div>

			{isLoading ? (
				<div className="flex-1 flex justify-center items-center">
					<Spinner className="h-8 w-8 text-primary" />
				</div>
			) : (
				<main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 md:px-8 space-y-12">
					
					{/* Categories Row */}
					<section className="grid grid-cols-2 md:grid-cols-4 gap-4">
						{CATEGORIES.map((cat, i) => (
							<div key={i} className="relative rounded-xl overflow-hidden aspect-[4/3] md:aspect-[2/1] group cursor-pointer shadow-sm">
								<Image
									src={cat.image}
									alt={cat.name}
									fill
									className="object-cover transition-transform group-hover:scale-105"
								/>
								<div className="absolute inset-0 bg-black/40 flex items-center justify-center">
									<h3 className="text-white font-bold text-lg">{cat.name}</h3>
								</div>
							</div>
						))}
					</section>

					{/* Dynamic Hero Banner */}
					{bannerUrl && (
						<section className="w-full relative aspect-[3/1] max-h-[300px] rounded-2xl overflow-hidden shadow-md">
							<Image
								src={bannerUrl}
								alt="Market Banner"
								fill
								className="object-cover"
							/>
						</section>
					)}

					{/* Flash Sales Row */}
					<section className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-4">
								<h2 className="text-2xl font-bold text-primary flex items-center gap-2">
									<span className="text-yellow-500">⚡</span> Flash Sales
								</h2>
								<span className="text-red-500 font-medium hidden md:inline-block">12hrs : 45mins Left</span>
							</div>
							<Link href="/products" className="text-primary flex items-center text-sm font-medium hover:underline">
								view more <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-1" />
							</Link>
						</div>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
							{flashSales.map((product) => (
								<ProductCard key={product._id} product={product} />
							))}
						</div>
					</section>

					{/* Ads Banner Section */}
					{ads.length > 0 && (
						<section className="grid md:grid-cols-2 gap-4">
							{ads.slice(0, 2).map((ad) => (
								<a
									key={ad._id}
									href={ad.targetUrl || "#"}
									target={ad.targetUrl ? "_blank" : undefined}
									rel="noreferrer"
									className="group relative rounded-2xl overflow-hidden aspect-[21/9] shadow-sm hover:shadow-md transition-shadow block"
								>
									<Image
										src={ad.imageUrl}
										alt={ad.description || "Ad"}
										fill
										className="object-cover transition-transform group-hover:scale-105"
									/>
									<div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-4">
										<p className="text-white font-medium text-sm md:text-base line-clamp-2">
											{ad.description}
										</p>
									</div>
								</a>
							))}
						</section>
					)}

					{/* Vendor Spotlight */}
					<section className="space-y-6">
						<div className="flex items-center justify-between">
							<h2 className="text-2xl font-bold text-primary flex items-center gap-2">
								<span className="text-yellow-400">💡</span> Vendor Spotlight
							</h2>
							<Link href="/vendors" className="text-primary flex items-center text-sm font-medium hover:underline">
								view more <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-1" />
							</Link>
						</div>
						<div className="flex gap-6 overflow-x-auto pb-4 snap-x border-b">
							{vendors.map((vendor) => (
								<div key={vendor._id} className="flex flex-col items-center gap-2 snap-center min-w-[100px]">
									<div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md">
										<Avatar className="w-full h-full">
											<AvatarImage src={vendor.businessLogo || vendor.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${vendor.businessName}`} className="object-cover" />
											<AvatarFallback>{vendor.businessName?.charAt(0)}</AvatarFallback>
										</Avatar>
									</div>
									<span className="text-xs font-medium text-center truncate w-full px-2" title={vendor.businessName}>
										{vendor.businessName}
									</span>
								</div>
							))}
						</div>
					</section>

					{/* Skilled Workers Row */}
					<section className="space-y-4">
						<div className="flex items-center justify-between">
							<h2 className="text-2xl font-bold text-primary flex items-center gap-2">
								<span className="text-yellow-500">🛠️</span> Skilled Workers
							</h2>
							<Link href="/services" className="text-primary flex items-center text-sm font-medium hover:underline">
								view more <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-1" />
							</Link>
						</div>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
							{skilledWorkers.map((product) => (
								<ProductCard key={product._id} product={product} />
							))}
						</div>
					</section>

					{/* Market Gossip (RSS Feed) */}
					{rssItems.length > 0 && (
						<section className="space-y-4 pt-4">
							<div className="flex items-center justify-between">
								<h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
									Market gossip <span className="text-yellow-600">🗣️</span>
								</h2>
								<a href={rssUrl} target="_blank" rel="noreferrer" className="text-muted-foreground flex items-center text-sm font-medium hover:underline">
									View more <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-1" />
								</a>
							</div>
							<div className="grid md:grid-cols-3 gap-6">
								{rssItems.map((item, idx) => (
									<a key={idx} href={item.link} target="_blank" rel="noreferrer" className="block group">
										<div className="bg-white rounded-2xl overflow-hidden shadow-sm border hover:shadow-md transition-shadow h-full flex flex-col">
											<div className="bg-slate-100 flex items-center justify-center p-8 aspect-video relative">
												{/* Decorative content block for mockup parity */}
												<span className="text-6xl absolute z-10">😍</span>
												<div className="w-full h-full bg-slate-200/50 rounded-xl" />
											</div>
											<div className="p-4 flex-1 flex flex-col">
												<h3 className="font-bold text-lg leading-tight group-hover:text-primary mb-2 line-clamp-2">{item.title}</h3>
												<p className="text-xs text-muted-foreground line-clamp-2">{item.description || "Most searched items this week by location and demographic."}</p>
											</div>
										</div>
									</a>
								))}
							</div>
						</section>
					)}

				</main>
			)}
		</div>
	);
}
