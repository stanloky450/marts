import QRCode from "qrcode";
import type { StorefrontTheme } from "@/lib/storefront-theme";

type VendorQrOptions = {
	businessName: string;
	storefrontUrl: string;
	theme: StorefrontTheme;
	size?: number;
};

function slugify(value: string) {
	return (
		value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "vendor-storefront"
	);
}

function loadImage(src: string) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = reject;
		image.src = src;
	});
}

export async function generateVendorQrCodeDataUrl({
	storefrontUrl,
	theme,
	size = 720,
}: VendorQrOptions) {
	return QRCode.toDataURL(storefrontUrl, {
		errorCorrectionLevel: "H",
		margin: 1,
		width: size,
		color: {
			dark: theme.text,
			light: theme.accent,
		},
	});
}

export async function downloadVendorQrCode(options: VendorQrOptions) {
	const qrDataUrl = await generateVendorQrCodeDataUrl(options);
	const qrImage = await loadImage(qrDataUrl);
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");

	if (!context) {
		throw new Error("QR download is not supported in this browser.");
	}

	canvas.width = 1080;
	canvas.height = 1320;

	context.fillStyle = options.theme.background;
	context.fillRect(0, 0, canvas.width, canvas.height);

	context.fillStyle = options.theme.accent;
	context.fillRect(72, 72, canvas.width - 144, canvas.height - 144);

	context.drawImage(qrImage, 170, 210, 740, 740);

	context.fillStyle = options.theme.text;
	context.textAlign = "center";
	context.font = "700 54px sans-serif";
	context.fillText(options.businessName, canvas.width / 2, 140);

	context.font = "500 34px sans-serif";
	context.fillText("Scan to open the vendor storefront", canvas.width / 2, 1020);

	context.font = "400 24px sans-serif";
	const urlLabel =
		options.storefrontUrl.length > 60
			? `${options.storefrontUrl.slice(0, 57)}...`
			: options.storefrontUrl;
	context.fillText(urlLabel, canvas.width / 2, 1080);

	const downloadUrl = canvas.toDataURL("image/png");
	const link = document.createElement("a");
	link.href = downloadUrl;
	link.download = `${slugify(options.businessName)}-storefront-qr.png`;
	link.click();

	return downloadUrl;
}
