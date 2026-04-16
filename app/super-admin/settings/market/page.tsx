"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { settingService } from "@/lib/services/setting.service";
import { apiClient } from "@/lib/api-client";
import { HugeiconsIcon } from "@hugeicons/react"
import { Store01Icon } from "@hugeicons/core-free-icons"

export default function MarketSettingsPage() {
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isUploading, setIsUploading] = useState(false);

	const [config, setConfig] = useState({
		market_banner_url: "",
		market_rss_url: "",
		market_rss_ad_count: 5,
		market_rss_avg_time: 10,
		feature_chat_enabled: true,
		feature_reviews_enabled: true,
	});

	useEffect(() => {
		const fetchConfig = async () => {
			try {
				const response = await settingService.getAllSettings();
				const dbConfig = response.data.data;
				setConfig((prev) => ({
					market_banner_url: dbConfig.market_banner_url || prev.market_banner_url,
					market_rss_url: dbConfig.market_rss_url || prev.market_rss_url,
					market_rss_ad_count: Number(dbConfig.market_rss_ad_count) || prev.market_rss_ad_count,
					market_rss_avg_time: Number(dbConfig.market_rss_avg_time) || prev.market_rss_avg_time,
					feature_chat_enabled:
						dbConfig.feature_chat_enabled !== undefined
							? Boolean(dbConfig.feature_chat_enabled)
							: prev.feature_chat_enabled,
					feature_reviews_enabled:
						dbConfig.feature_reviews_enabled !== undefined
							? Boolean(dbConfig.feature_reviews_enabled)
							: prev.feature_reviews_enabled,
				}));
			} catch (error) {
				console.error("Failed to fetch settings", error);
				toast.error("Failed to load settings");
			} finally {
				setIsLoading(false);
			}
		};

		fetchConfig();
	}, []);

	const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setIsUploading(true);
		try {
			const uploadFormData = new FormData();
			uploadFormData.append("file", file);

			const response = await apiClient.post("/media/uploadfile", uploadFormData, {
				headers: { "Content-Type": "multipart/form-data" },
			});
			const imageUrl = (response as any)?.data?.imageUrl;

			setConfig((prev) => ({ ...prev, market_banner_url: imageUrl }));
			toast.success("Image uploaded successfully");
		} catch (error) {
			console.error("Upload error:", error);
			toast.error("Failed to upload image");
		} finally {
			setIsUploading(false);
		}
	};

	const handleSave = async () => {
		setIsSubmitting(true);
		try {
			await settingService.updateSettings(config);
			toast.success("Settings saved successfully");
		} catch (error) {
			console.error("Failed to save settings", error);
			toast.error("Failed to save settings");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<ProtectedRoute allowedRoles={["super_admin"]}>
			<DashboardLayout>
				<div className="space-y-6">
					<div>
						<h1 className="text-3xl font-bold">Market Page Settings</h1>
						<p className="text-muted-foreground">
							Customize the appearance and content density of the public Market page.
						</p>
					</div>

					{isLoading ? (
						<div className="flex justify-center py-8">
							<Spinner className="h-8 w-8" />
						</div>
					) : (
						<div className="grid gap-6 md:grid-cols-2">
							{/* Banner Settings */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<HugeiconsIcon icon={Store01Icon} className="h-5 w-5" />
										Hero Banner
									</CardTitle>
									<CardDescription>
										Update the main promotional banner displayed at the top of the Market page.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										<Label>Current Banner Image</Label>
										{config.market_banner_url ? (
											<div className="relative aspect-[3/1] w-full overflow-hidden rounded-lg border bg-muted">
												<img
													src={config.market_banner_url}
													alt="Market Banner"
													className="object-cover w-full h-full"
												/>
											</div>
										) : (
											<div className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/50 text-muted-foreground">
												No banner uploaded
											</div>
										)}
									</div>
									<div className="space-y-2">
										<Label>Upload New Banner</Label>
										<div className="flex items-center gap-4">
											<Input
												type="file"
												accept="image/*"
												onChange={handleImageUpload}
												disabled={isUploading}
											/>
											{isUploading && <Spinner className="h-4 w-4" />}
										</div>
										<p className="text-xs text-muted-foreground">
											Recommended aspect ratio: 3:1 (e.g., 1200x400)
										</p>
									</div>
								</CardContent>
							</Card>

							{/* RSS Settings */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										RSS Feed (Market Gossip)
									</CardTitle>
									<CardDescription>
										Configure the news feed displayed at the bottom of the Market page.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										<Label>RSS Feed API Endpoint</Label>
										<Input
											placeholder="https://example.com/feed.xml"
											value={config.market_rss_url}
											onChange={(e) =>
												setConfig({ ...config, market_rss_url: e.target.value })
											}
										/>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Number of Ads/Items</Label>
											<Input
												type="number"
												min={1}
												max={20}
												value={config.market_rss_ad_count}
												onChange={(e) =>
													setConfig({
														...config,
														market_rss_ad_count: Number(e.target.value),
													})
												}
											/>
										</div>
										<div className="space-y-2">
											<Label>Average Time (Secs)</Label>
											<Input
												type="number"
												min={1}
												value={config.market_rss_avg_time}
												onChange={(e) =>
													setConfig({
														...config,
														market_rss_avg_time: Number(e.target.value),
													})
												}
											/>
										</div>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>Feature Controls</CardTitle>
									<CardDescription>
										Turn private chat and reviews on or off globally.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex items-center justify-between rounded-lg border p-3">
										<div>
											<Label>Enable Private Chat</Label>
											<p className="text-xs text-muted-foreground">
												Users can chat vendors and vendors can reply privately.
											</p>
										</div>
										<Switch
											checked={config.feature_chat_enabled}
											onCheckedChange={(checked) =>
												setConfig({ ...config, feature_chat_enabled: checked })
											}
										/>
									</div>
									<div className="flex items-center justify-between rounded-lg border p-3">
										<div>
											<Label>Enable Reviews & Ratings</Label>
											<p className="text-xs text-muted-foreground">
												Users can rate and leave text feedback for vendors/products.
											</p>
										</div>
										<Switch
											checked={config.feature_reviews_enabled}
											onCheckedChange={(checked) =>
												setConfig({ ...config, feature_reviews_enabled: checked })
											}
										/>
									</div>
								</CardContent>
							</Card>

							{/* Actions */}
							<div className="md:col-span-2 flex justify-end">
								<Button size="lg" onClick={handleSave} disabled={isSubmitting}>
									{isSubmitting ? (
										<>
											<Spinner className="mr-2 h-4 w-4" />
											Saving Changes...
										</>
									) : (
										"Save Settings"
									)}
								</Button>
							</div>
						</div>
					)}
				</div>
			</DashboardLayout>
		</ProtectedRoute>
	);
}
