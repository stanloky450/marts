"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Settings02Icon,
	Image01Icon,
	Loading03Icon,
} from "@hugeicons/core-free-icons";
import { vendorService } from "@/lib/services/vendor.service"
import { toast } from "sonner"
import type { Vendor } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api-client"
import { Settings, ImageIcon, Loader2, Copy, Download } from "lucide-react";
import {
  STOREFRONT_THEMES,
  getStorefrontTheme,
  getStorefrontThemeStyles,
  type StorefrontThemeId,
} from "@/lib/storefront-theme";
import {
  downloadVendorQrCode,
  generateVendorQrCodeDataUrl,
} from "@/lib/vendor-qr";

export default function VendorSettingsPage() {
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // Form State
  const [themeColor, setThemeColor] = useState<StorefrontThemeId>("midnight_berry")
  const [bannerUrl, setBannerUrl] = useState<string>("")
  const [logoUrl, setLogoUrl] = useState<string>("")
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [facebook, setFacebook] = useState("")
  const [instagram, setInstagram] = useState("")
  const [xHandle, setXHandle] = useState("")
  const [storefrontUrl, setStorefrontUrl] = useState("")
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("")
  const [isDownloadingQr, setIsDownloadingQr] = useState(false)

  const extractErrorMessage = (error: any, fallback: string) =>
    error?.response?.data?.error?.message || error?.response?.data?.message || fallback

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await vendorService.getProfile()
        const vendorData = response.data.data.vendor
        setVendor(vendorData)
        setThemeColor(getStorefrontTheme(vendorData.themeColor).id)
        if (vendorData.bannerImage) setBannerUrl(vendorData.bannerImage)
        if (vendorData.logoUrl) setLogoUrl(vendorData.logoUrl)
        const socials = (vendorData as Vendor & { socials?: { facebook?: string; instagram?: string; x?: string; twitter?: string } }).socials
        setFacebook(socials?.facebook || vendorData.socialMedia?.facebook || "")
        setInstagram(socials?.instagram || vendorData.socialMedia?.instagram || "")
        setXHandle(socials?.x || socials?.twitter || vendorData.socialMedia?.twitter || "")
      } catch (error) {
        toast.error("Failed to load profile settings")
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [])

  useEffect(() => {
    if (!vendor?.subdomain || typeof window === "undefined") {
      setStorefrontUrl("")
      setQrCodeDataUrl("")
      return
    }

    const nextStorefrontUrl = `${window.location.origin}/store/${vendor.subdomain}`
    setStorefrontUrl(nextStorefrontUrl)

    void generateVendorQrCodeDataUrl({
      businessName: vendor.businessName,
      storefrontUrl: nextStorefrontUrl,
      theme: getStorefrontTheme(themeColor),
    })
      .then(setQrCodeDataUrl)
      .catch((error) => {
        console.error("Failed to generate vendor QR code", error)
      })
  }, [vendor?.subdomain, vendor?.businessName, themeColor])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    const formData = new FormData()
    formData.append("image", file)

    try {
      const response = await apiClient.uploadFile<{ success: boolean; data: { url: string } }>(
        "/media/upload",
        formData
      )
      
      if (response.data.success) {
        const uploadedUrl = response.data.data.url
        setBannerUrl(uploadedUrl)
        await vendorService.updateProfile({ bannerImage: uploadedUrl })
        toast.success("Banner uploaded and saved")
      }
    } catch (error: any) {
      toast.error(extractErrorMessage(error, "Failed to upload image"))
    } finally {
      setUploadingImage(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    const formData = new FormData()
    formData.append("image", file)

    try {
      const response = await apiClient.uploadFile<{ success: boolean; data: { url: string } }>(
        "/media/upload",
        formData
      )
      
      if (response.data.success) {
        const uploadedUrl = response.data.data.url
        setLogoUrl(uploadedUrl)
        await vendorService.updateProfile({ logoUrl: uploadedUrl })
        toast.success("Logo uploaded and saved")
      }
    } catch (error: any) {
      toast.error(extractErrorMessage(error, "Failed to upload logo"))
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      // Always include all image URLs in the payload so they're never lost
      const payload: Partial<Vendor> = {
        themeColor: themeColor as any,
        ...(bannerUrl ? { bannerImage: bannerUrl } : {}),
        ...(logoUrl ? { logoUrl: logoUrl } : {}),
        socials: {
          facebook: facebook.trim(),
          instagram: instagram.trim(),
          x: xHandle.trim(),
        } as any,
      }

      await vendorService.updateProfile(payload)
      toast.success("Settings saved successfully")

      // Re-fetch profile to ensure UI reflects actual DB state
      const refreshed = await vendorService.getProfile()
      const vendorData = refreshed.data.data.vendor
      setVendor(vendorData)
      setThemeColor(getStorefrontTheme(vendorData.themeColor).id)
      if (vendorData.bannerImage) setBannerUrl(vendorData.bannerImage)
      else setBannerUrl("")
      if (vendorData.logoUrl) setLogoUrl(vendorData.logoUrl)
      else setLogoUrl("")
      const socials = (vendorData as Vendor & { socials?: { facebook?: string; instagram?: string; x?: string; twitter?: string } }).socials
      setFacebook(socials?.facebook || vendorData.socialMedia?.facebook || "")
      setInstagram(socials?.instagram || vendorData.socialMedia?.instagram || "")
      setXHandle(socials?.x || socials?.twitter || vendorData.socialMedia?.twitter || "")
    } catch (error: any) {
      console.error("Save settings error:", error)
      const errObj = error?.response?.data?.error;
      const details = errObj?.details ? JSON.stringify(errObj.details) : "";
      const errMessage = errObj?.message || error?.response?.data?.message || "Failed to save settings";
      toast.error(`${errMessage} ${details}`.trim())
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopyStorefrontLink = async () => {
    if (!storefrontUrl) return

    try {
      await navigator.clipboard.writeText(storefrontUrl)
      toast.success("Storefront link copied")
    } catch {
      toast.error("Failed to copy storefront link")
    }
  }

  const handleDownloadQr = async () => {
    if (!storefrontUrl || !vendor) return

    setIsDownloadingQr(true)
    try {
      await downloadVendorQrCode({
        businessName: vendor.businessName,
        storefrontUrl,
        theme: getStorefrontTheme(themeColor),
      })
      toast.success("Storefront QR code downloaded")
    } catch (error) {
      console.error("Failed to download vendor QR code", error)
      toast.error("Failed to download storefront QR code")
    } finally {
      setIsDownloadingQr(false)
    }
  }

  if (isLoading) {
    return (
			<ProtectedRoute allowedRoles={["vendor"]}>
				<DashboardLayout userRole="vendor">
					<div className="flex h-[50vh] items-center justify-center">
						<HugeiconsIcon
							icon={Loading03Icon}
							className="h-8 w-8 animate-spin text-muted-foreground"
						/>
					</div>
				</DashboardLayout>
			</ProtectedRoute>
		);
  }

  return (
    <ProtectedRoute allowedRoles={["vendor"]}>
      <DashboardLayout userRole="vendor">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your account settings</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <CardTitle>Storefront Design</CardTitle>
              </div>
              <CardDescription>Customize the look and feel of your storefront.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              
              {/* Banner Image Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Storefront Hero Banner Image</Label>
                  <p className="text-sm text-muted-foreground">
                    This image will appear at the top of your public storefront. Maximum size 5MB.
                  </p>
                </div>
                
                <div className="flex items-start gap-6">
                   <div className="relative flex h-40 w-full max-w-2xl items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-muted">
                     {bannerUrl ? (
                         <img src={bannerUrl} alt="Store banner" className="h-full w-full object-cover" />
                     ) : (
                         <div className="flex flex-col items-center gap-2 text-muted-foreground">
                           <ImageIcon className="h-8 w-8" />
                           <span>No banner selected</span>
                         </div>
                     )}
                     
                     {uploadingImage && (
                       <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                       </div>
                     )}
                   </div>
                   
                   <div className="flex-shrink-0">
                      <Input 
                        type="file" 
                        accept="image/*"
                        className="hidden" 
                        id="banner-upload"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                      />
                      <Label htmlFor="banner-upload">
                        <Button asChild variant="secondary" disabled={uploadingImage}>
                          <span>{uploadingImage ? "Uploading..." : bannerUrl ? "Change Banner" : "Upload Banner"}</span>
                        </Button>
                      </Label>
                   </div>
                </div>
              </div>

              <div className="my-6 border-t" />

              {/* Logo Image Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Storefront Logo</Label>
                  <p className="text-sm text-muted-foreground">
                    This logo will appear on your store. Recommended size 256x256px.
                  </p>
                </div>
                
                <div className="flex items-start gap-6">
                   <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-2 border-dashed bg-muted">
                     {logoUrl ? (
                         <img src={logoUrl} alt="Store logo" className="h-full w-full object-cover" />
                     ) : (
                         <div className="flex flex-col items-center gap-1 text-muted-foreground">
                           <ImageIcon className="h-6 w-6" />
                         </div>
                     )}
                     
                     {uploadingLogo && (
                       <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-full">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                       </div>
                     )}
                   </div>
                   
                   <div className="flex-shrink-0 self-center">
                      <Input 
                        type="file" 
                        accept="image/*"
                        className="hidden" 
                        id="logo-upload"
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                      />
                      <Label htmlFor="logo-upload">
                        <Button asChild variant="secondary" disabled={uploadingLogo}>
                           <span>{uploadingLogo ? "Uploading..." : logoUrl ? "Change Logo" : "Upload Logo"}</span>
                        </Button>
                      </Label>
                   </div>
                </div>
              </div>
              
              <div className="my-6 border-t" />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Storefront QR Code</Label>
                  <p className="text-sm text-muted-foreground">
                    Download a QR code for your storefront and copy the direct store link for flyers, packaging, and social posts.
                  </p>
                </div>

                {!vendor?.subdomain ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Your storefront link will appear here after a store subdomain is available.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 rounded-2xl border bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      {qrCodeDataUrl ? (
                        <img
                          src={qrCodeDataUrl}
                          alt={`${vendor.businessName} storefront QR code`}
                          className="h-24 w-24 rounded-xl border bg-white p-2"
                        />
                      ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded-xl border bg-background text-xs text-muted-foreground">
                          Generating QR
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="text-sm font-medium">{vendor.businessName}</p>
                        <p className="break-all text-xs text-muted-foreground">{storefrontUrl}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={handleCopyStorefrontLink} disabled={!storefrontUrl}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Link
                      </Button>
                      <Button type="button" onClick={handleDownloadQr} disabled={isDownloadingQr || !qrCodeDataUrl}>
                        <Download className="mr-2 h-4 w-4" />
                        {isDownloadingQr ? "Preparing..." : "Download QR"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="my-6 border-t" />

              {/* Social Media Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Social Media</Label>
                  <p className="text-sm text-muted-foreground">
                    Add or update your social profiles. You can enter full URLs or handles.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="facebook">Facebook</Label>
                    <Input
                      id="facebook"
                      placeholder="facebook.com/yourpage or @yourpage"
                      value={facebook}
                      onChange={(e) => setFacebook(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram</Label>
                    <Input
                      id="instagram"
                      placeholder="instagram.com/yourhandle or @yourhandle"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="xHandle">X (Twitter)</Label>
                  <Input
                    id="xHandle"
                    placeholder="x.com/yourhandle or @yourhandle"
                    value={xHandle}
                    onChange={(e) => setXHandle(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="my-6 border-t" />

              {/* Theme Color Selection */}
              <div className="space-y-4">
                <div className="space-y-2">
                   <Label>Storefront Theme Color</Label>
                   <p className="text-sm text-muted-foreground">
                      Select a storefront variant. Background drives surfaces, accent drives buttons and highlights, and text drives copy.
                   </p>
                </div>
                
                <RadioGroup 
                  value={themeColor} 
                  onValueChange={(value) => setThemeColor(value as StorefrontThemeId)}
                  className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                >
                  {STOREFRONT_THEMES.map((theme) => {
                    const styles = getStorefrontThemeStyles(theme.id)
                    return (
                    <div key={theme.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={theme.id} id={theme.id} className="sr-only" />
                      <Label
                        htmlFor={theme.id}
                        className={`flex cursor-pointer flex-col items-start justify-between rounded-xl border-2 p-4 transition-transform hover:-translate-y-0.5 ${
                          themeColor === theme.id ? "border-primary shadow-sm" : "border-muted bg-popover"
                        }`}
                        style={{
                          background: styles.pageBackground,
                          borderColor: themeColor === theme.id ? theme.text : styles.softBorder,
                        }}
                      >
                         <div className="mb-4 flex w-full items-center gap-3">
                           <div className="h-10 w-10 rounded-full border" style={{ background: theme.background, borderColor: styles.softBorder }} />
                           <div className="h-10 w-10 rounded-full border" style={{ background: theme.accent, borderColor: styles.softBorder }} />
                           <div className="h-10 w-10 rounded-full border" style={{ background: theme.text, borderColor: styles.softBorder }} />
                         </div>
                         <div className="w-full rounded-xl p-4" style={{ background: styles.heroBackground, color: theme.text }}>
                           <div className="mb-3 text-sm font-semibold">{theme.name}</div>
                           <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: theme.accent, color: styles.buttonText }}>
                             <span className="text-xs font-semibold">Accent Button</span>
                             <span className="text-xs font-medium">Preview</span>
                           </div>
                         </div>
                         <div className="mt-3 space-y-1 text-left">
                           <span className="block text-sm font-medium">{theme.name}</span>
                           <span className="block text-xs text-muted-foreground">
                             BG {theme.background} · Text {theme.text} · Accent {theme.accent}
                           </span>
                         </div>
                      </Label>
                    </div>
                  )})}
                </RadioGroup>
              </div>

              <div className="pt-4">
                 <Button onClick={handleSaveSettings} disabled={isSaving}>
                   {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                   Save Changes
                 </Button>
              </div>

            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
