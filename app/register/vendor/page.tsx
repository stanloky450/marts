"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, Upload01Icon, CheckmarkBadge01Icon } from "@hugeicons/core-free-icons";
import {
	vendorService,
	type RegisterVendorData,
} from "@/lib/services/vendor.service";
import Image from "next/image";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { referralService } from "@/lib/services/referral.service";
import { apiClient } from "@/lib/api-client";
import LocationSelector from "@/components/LocationSelector";
import { locationService, type Location } from "@/lib/services/location.service";

const STEPS = [
	{ id: 1, title: "Account Info", description: "Create your account" },
	{
		id: 2,
		title: "Business Details",
		description: "Tell us about your business",
	},
	{
		id: 3,
		title: "Media & Social",
		description: "Upload images and social links",
	},
	{ id: 4, title: "Review & Pay", description: "Review and complete payment" },
];

const ARTISAN_CATEGORIES = [
	"Welding and Fabrication",
	"Carpentry and Furniture Making",
	"Plumbing",
	"Architecture",
	"Tailoring",
	"Shoemaking",
	"Pottery",
	"Jewelry Making",
	"Appliance Repair",
	"Computer Repairs / IT Services",
	"Electrical and Appliance Repair",
];

export default function RegisterPage() {
	const router = useRouter();
	const [currentStep, setCurrentStep] = useState(1);
	const [isLoading, setIsLoading] = useState(false);
	const [isValidatingReferral, setIsValidatingReferral] = useState(false);
	const [referralDiscount, setReferralDiscount] = useState(0);
	const [location, setLocation] = useState({ region: "", area: "" });
	const [baseFee, setBaseFee] = useState(10000);

	const [formData, setFormData] = useState<RegisterVendorData>({
		firstName: "",
		lastName: "",
		email: "",
		passwordHash: "",
		businessName: "",
		phoneNumber: "",
		whatsappNumber: "",
		description: "",
		socialMedia: {
			facebook: "",
			instagram: "",
			twitter: "",
		},
		// logoUrl: "",
		referralCode: "",
		businessType: "", // New field
		artisanCategory: "", // New field
		// photoUrl: "",
		logoUrl: "",
		profilePhotoUrl: "",
	});

	const [businessLogo, setBusinessLogo] = useState(false);
	// const [businessLogo, setBusinessLogo] = useState<File | null>(null);
	const [businessLogoPreview, setBusinessLogoPreview] = useState<string>("");
	// const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
	const [profilePhoto, setProfilePhoto] = useState(false);
	const [profilePhotoPreview, setProfilePhotoPreview] = useState<string>("");
	// const [profilePhotoPreview, setProfilePhotoPreview] = useState<string>("");
	const [error, setError] = useState("");

	const handleInputChange = (field: string, value: string) => {
		setFormData((prev: RegisterVendorData) => ({ ...prev, [field]: value }));
	};

	const handleSocialMediaChange = (platform: string, value: string) => {
		setFormData((prev: RegisterVendorData) => ({
			...prev,
			socialMedia: {
				...prev.socialMedia,
				[platform]: value,
			},
		}));
	};

	const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: "profilePhotoUrl" | "logoUrl") => {
		const file = e.target.files?.[0];
		if (!file) return;

		try {
			if (fieldName === "profilePhotoUrl") {
				setProfilePhoto(true);
			} else if (fieldName === "logoUrl") {
				setBusinessLogo(true);
			}

			const uploadFormData = new FormData();
			uploadFormData.append("file", file);

			// console.log("[v0] Uploading file:", file.name);
			const response = await apiClient.post(
				"/media/uploadfile",
				uploadFormData,
				{
					headers: { "Content-Type": "multipart/form-data" },
				}
			);

			// console.log("[v0] Upload response:", (response as any)?.data);
			const imageUrl = (response as any)?.data?.imageUrl ?? "";
			setFormData((prev) => ({ ...prev, [fieldName]: imageUrl }));

			setError("");
		} catch (err: unknown) {
			console.error("Upload error:", err);
			const errorMessage =
				(err as any)?.response?.data?.error ||
				(err as any)?.message ||
				`Failed to upload ${fieldName}`;
			setError(errorMessage);
		} finally {
			if (fieldName === "profilePhotoUrl") {
				setProfilePhoto(false);
			} else if (fieldName === "logoUrl") {
				setBusinessLogo(false);
			}
		}
	};

	const validateReferralCode = async () => {
		const raw = formData.referralCode || "";
		const code = raw.toString().trim();
		if (!code) return;
		setIsValidatingReferral(true);
		try {
			const response = await referralService.validate(code);
			console.log("validateReferralCode response:", response?.data);
			const referral: any = response.data.data;
			const discount = referral?.discountPercent ?? 0;

			if (discount > 0) {
				setReferralDiscount(discount);
				toast.success(`Referral code applied! ${discount}% discount`);
			} else {
				toast.error("Invalid referral code");
				setReferralDiscount(0);
			}
		} catch (error: unknown) {
			const err = error as { response?: any; message?: string };
			console.error(" Referral validation error:", err?.response || err);
			const serverMessage =
				err?.response?.data?.error?.message || err?.response?.data?.message;
			if (serverMessage) {
				toast.error(serverMessage);
			} else {
				toast.error("Failed to validate referral code");
			}
			setReferralDiscount(0);
		} finally {
			setIsValidatingReferral(false);
		}
	};

	const handleSubmit = async () => {
		setIsLoading(true);

		try {
			// const form = new FormData();

			// form.append("region", location.region);
			// form.append("area", location.area);
			const formDoc = {
				...formData,
				socials: {
					facebook: formData.socialMedia?.facebook?.trim() || "",
					instagram: formData.socialMedia?.instagram?.trim() || "",
					x: formData.socialMedia?.twitter?.trim() || "",
				},
				region: location.region,
				area: location.area,
			};
			console.log("Submitting form data:", formDoc);
			const response = await vendorService.registerInit(formDoc);
			console.log(response);
			const payload: any = (response as any).data?.data;
			const payment = payload?.payment;
			const authorizationUrl =
				payment?.authorizationUrl ||
				payment?.authorization_url ||
				payment?.authorization?.url;
			if (authorizationUrl) {
				toast.success("Redirecting to payment...");
				window.location.href = authorizationUrl;
			} else {
				toast.error("Payment authorization URL not found");
				setIsLoading(false);
			}
		} catch (error: unknown) {
			const err = error as { response?: any; message?: string };
			console.error("Registration error:", err?.response || err);
			const serverMessage = err?.response?.data?.error?.message || err?.message;
			if (serverMessage) {
				toast.error(serverMessage);
			} else {
				toast.error("Registration failed. Please try again.");
			}
			setIsLoading(false);
		}
	};

	const canProceed = () => {
		switch (currentStep) {
			case 1:
				return (
					formData.email &&
					formData.passwordHash &&
					formData.passwordHash.length >= 6
				);
			case 2:
				return (
					formData.businessName &&
					formData.phoneNumber &&
					formData.businessType &&
					location.region &&
					location.area
				);
			case 3:
				return true;
			case 4:
				return true;
			default:
				return false;
		}
	};

	const progress = (currentStep / STEPS.length) * 100;

	console.log(formData);

	return (
		<div className="min-h-screen bg-muted/40 p-4 py-12">
			<div className="mx-auto max-w-3xl">
				<Card>
					<CardHeader>
						<CardTitle className="text-3xl">Vendor Registration</CardTitle>
						<CardDescription>
							Join our marketplace and start selling today
						</CardDescription>
						<div className="mt-4">
							<Progress value={progress} className="h-2" />
							<div className="mt-2 flex justify-between text-sm text-muted-foreground">
								{STEPS.map((step) => (
									<div
										key={step.id}
										className={`flex flex-col items-center ${
											currentStep >= step.id ? "text-primary" : ""
										}`}
									>
										<div
											className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
												currentStep >= step.id
													? "border-primary bg-primary text-primary-foreground"
													: "border-muted"
											}`}
										>
											{currentStep > step.id ? (
												<HugeiconsIcon icon={CheckmarkBadge01Icon} className="h-4 w-4" />
											) : (
												step.id
											)}
										</div>
										<span className="mt-1 hidden text-xs sm:block">
											{step.title}
										</span>
									</div>
								))}
							</div>
						</div>
					</CardHeader>

					<CardContent className="space-y-6">
						{/* Step 1: Account Info */}
						{currentStep === 1 && (
							<div className="space-y-4">
								<div>
									<Label>First Name</Label>
									<Input
										placeholder="First Name"
										value={formData.firstName}
										onChange={(e) =>
											handleInputChange("firstName", e.target.value)
										}
									/>
								</div>
								<div>
									<Label>Last Name</Label>
									<Input
										placeholder="Last Name"
										value={formData.lastName}
										onChange={(e) =>
											handleInputChange("lastName", e.target.value)
										}
									/>
								</div>
								<div>
									<Label>Email Address</Label>
									<Input
										type="email"
										placeholder="you@example.com"
										value={formData.email}
										onChange={(e) => handleInputChange("email", e.target.value)}
									/>
								</div>
								<div>
									<Label>Password</Label>
									<Input
										type="password"
										placeholder="••••••••"
										value={formData.passwordHash}
										onChange={(e) =>
											handleInputChange("passwordHash", e.target.value)
										}
									/>
									<p className="text-xs text-muted-foreground">
										Minimum 6 characters
									</p>
								</div>
							</div>
						)}

						{/* Step 2: Business Details */}
						{currentStep === 2 && (
							<div className="space-y-4">
								<div>
									<Label>Business Name</Label>
									<Input
										placeholder="Your Business Name"
										value={formData.businessName}
										onChange={(e) =>
											handleInputChange("businessName", e.target.value)
										}
									/>
								</div>

								<div>
									<Label>Business Type</Label>
									<Select
										onValueChange={(value) =>
											handleInputChange("businessType", value)
										}
										value={formData.businessType}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select Business Type" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="product">Product Sale</SelectItem>
											<SelectItem value="artisan">Artisan</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{formData.businessType === "artisan" && (
									<div>
										<Label>Artisan Category</Label>
										<Select
											onValueChange={(value) =>
												handleInputChange("artisanCategory", value)
											}
											value={formData.artisanCategory}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select Artisan Category" />
											</SelectTrigger>
											<SelectContent>
												{ARTISAN_CATEGORIES.map((cat) => (
													<SelectItem key={cat} value={cat}>
														{cat}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}

								<div>
									<Label>Business Description</Label>
									<Textarea
										placeholder="Tell us about your business..."
										value={formData.description}
										onChange={(e) =>
											handleInputChange("description", e.target.value)
										}
										rows={4}
									/>
								</div>

								<div className="grid gap-4 sm:grid-cols-2">
									<div>
										<Label>Phone Number</Label>
										<Input
											type="tel"
											placeholder="+234 800 000 0000"
											value={formData.phoneNumber}
											onChange={(e) =>
												handleInputChange("phoneNumber", e.target.value)
											}
										/>
									</div>
									<div>
										<Label>WhatsApp Number</Label>
										<Input
											type="tel"
											placeholder="+234 800 000 0000"
											value={formData.whatsappNumber}
											onChange={(e) =>
												handleInputChange("whatsappNumber", e.target.value)
											}
										/>
									</div>
								</div>

								{/* <LocationSelector
									onLocationChange={(loc) => setLocation(loc)}
								/> */}

								{/* LOCATION */}
								<LocationSelector
									onLocationChange={(loc) => {
										setLocation({ region: loc.region, area: loc.area });
										setBaseFee(loc.registrationFee || 10000);
									}}
								/>
							</div>
						)}

						{/* Step 3: Media & Social */}
						{currentStep === 3 && (
							<div className="space-y-4">
								{/* Media */}
								<div className="space-y-4">
									<h3 className="text-sm font-semibold">Media</h3>
									<div className="space-y-2">
										<label className="block text-sm">Profile Photo</label>
										<Input
											type="file"
											accept="image/*"
											onChange={(e) => handleImageUpload(e, "profilePhotoUrl")}
											disabled={profilePhoto}
										/>
										{formData.profilePhotoUrl && (
											<div className="flex items-center gap-2">
												<img
													src={formData.profilePhotoUrl || "/placeholder.svg"}
													alt="Profile"
													className="w-16 h-16 rounded object-cover"
												/>
												<span className="text-sm text-green-600">Uploaded</span>
											</div>
										)}
										{profilePhoto && (
											<span className="text-sm text-gray-500">
												Uploading...
											</span>
										)}
									</div>

									<div className="space-y-2">
										<label className="block text-sm">Logo</label>
										<Input
											type="file"
											accept="image/*"
											onChange={(e) => handleImageUpload(e, "logoUrl")}
											disabled={businessLogo}
										/>
										{formData.logoUrl && (
											<div className="flex items-center gap-2">
												<img
													src={formData.logoUrl || "/placeholder.svg"}
													alt="Logo"
													className="w-16 h-16 rounded object-cover"
												/>
												<span className="text-sm text-green-600">Uploaded</span>
											</div>
										)}
										{businessLogo && (
											<span className="text-sm text-gray-500">
												Uploading...
											</span>
										)}
									</div>
								</div>

								<div>
									<Label>Social Media Links (Optional)</Label>
									<div className="space-y-2">
										<Input
											placeholder="Facebook URL"
											value={formData.socialMedia?.facebook}
											onChange={(e) =>
												handleSocialMediaChange("facebook", e.target.value)
											}
										/>
										<Input
											placeholder="Instagram URL"
											value={formData.socialMedia?.instagram}
											onChange={(e) =>
												handleSocialMediaChange("instagram", e.target.value)
											}
										/>
										<Input
											placeholder="Twitter/X URL"
											value={formData.socialMedia?.twitter}
											onChange={(e) =>
												handleSocialMediaChange("twitter", e.target.value)
											}
										/>
									</div>
								</div>
							</div>
						)}

						{/* Step 4: Review & Pay */}
						{currentStep === 4 && (
							<div className="space-y-6">
								<div className="rounded-lg border p-4">
									<h3 className="mb-4 font-semibold">Registration Summary</h3>
									<div className="space-y-2 text-sm">
										<div className="flex justify-between">
											<span>Email:</span>
											<span>{formData.email}</span>
										</div>
										<div className="flex justify-between">
											<span>Business Type:</span>
											<span>{formData.businessType}</span>
										</div>
										{formData.businessType === "artisan" && (
											<div className="flex justify-between">
												<span>Category:</span>
												<span>{formData.artisanCategory}</span>
											</div>
										)}
										<div className="flex justify-between">
											<span>Business Name:</span>
											<span>{formData.businessName}</span>
										</div>
										<div className="flex justify-between">
											<span>Phone:</span>
											<span>{formData.phoneNumber}</span>
										</div>
									</div>
								</div>

								<div className="space-y-2">
									<Label>Referral Code (Optional)</Label>
									<div className="flex gap-2">
										<Input
											placeholder="Enter referral code"
											value={formData.referralCode}
											onChange={(e) =>
												handleInputChange("referralCode", e.target.value)
											}
										/>
										<Button
											onClick={validateReferralCode}
											disabled={!formData.referralCode || isValidatingReferral}
										>
											{isValidatingReferral ? (
												<Spinner className="h-4 w-4" />
											) : (
												"Apply"
											)}
										</Button>
									</div>
									{referralDiscount > 0 && (
										<p className="text-sm text-green-600">
											Discount applied: {referralDiscount}% off
										</p>
									)}
								</div>
								<div className="flex justify-between">
									<span>Location:</span>
									<span>
										{location.region && location.area
											? `${location.area}, ${location.region}`
											: "Not set"}
									</span>
								</div>

								<div className="rounded-lg border bg-muted/50 p-4">
									<div className="flex justify-between text-lg font-semibold">
										<span>Registration Fee:</span>
										<span>
											{referralDiscount > 0 && (
												<span className="mr-2 text-sm text-muted-foreground line-through">
													₦{baseFee.toLocaleString()}
												</span>
											)}
											₦
											{referralDiscount > 0
												? (baseFee * (1 - referralDiscount / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
												: baseFee.toLocaleString()}
										</span>
									</div>
								</div>
							</div>
						)}

						{/* Navigation Buttons */}
						<div className="flex justify-between pt-4">
							<Button
								variant="outline"
								onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
								disabled={currentStep === 1 || isLoading}
							>
								<HugeiconsIcon icon={ArrowLeft01Icon} className="mr-2 h-4 w-4" />
								Previous
							</Button>

							{currentStep < STEPS.length ? (
								<Button
									onClick={() => setCurrentStep((prev) => prev + 1)}
									disabled={!canProceed() || isLoading}
								>
									Next
									<HugeiconsIcon icon={ArrowRight01Icon} className="ml-2 h-4 w-4" />
								</Button>
							) : (
								<Button onClick={handleSubmit} disabled={isLoading}>
									{isLoading ? (
										<>
											<Spinner className="mr-2 h-4 w-4" />
											Processing...
										</>
									) : (
										"Register & Pay"
									)}
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}


