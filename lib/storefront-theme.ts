export const STOREFRONT_THEME_IDS = [
	"hot_coral",
	"electric_violet",
	"fuchsia_pop",
	"terracotta_glam",
	"midnight_berry",
	"blush_rose",
	"lavender_mist",
	"sage_and_cream",
	"hot_flamingo",
	"cherry_red",
	"candy_gradient",
	"papaya_punch",
] as const;

export type StorefrontThemeId = (typeof STOREFRONT_THEME_IDS)[number];

export type StorefrontTheme = {
	id: StorefrontThemeId;
	name: string;
	background: string;
	text: string;
	accent: string;
	lightBackground?: string;
	deep?: string;
	gradientStart?: string;
	gradientEnd?: string;
};

export const STOREFRONT_THEMES: StorefrontTheme[] = [
	{
		id: "hot_coral",
		name: "Hot Coral",
		background: "#FF6B6B",
		text: "#7B1D1D",
		accent: "#FF9A9A",
	},
	{
		id: "electric_violet",
		name: "Electric Violet",
		background: "#A855F7",
		text: "#FFFFFF",
		accent: "#F0ABFC",
		lightBackground: "#F3E8FF",
		deep: "#2C0B3F",
	},
	{
		id: "fuchsia_pop",
		name: "Fuchsia Pop",
		background: "#E91E8C",
		text: "#4A0029",
		accent: "#F9A8D4",
	},
	{
		id: "terracotta_glam",
		name: "Terracotta Glam",
		background: "#C0622F",
		text: "#3B1506",
		accent: "#F5CBA7",
	},
	{
		id: "midnight_berry",
		name: "Midnight Berry",
		background: "#4A235A",
		text: "#F3E5FF",
		accent: "#D2A8E8",
	},
	{
		id: "blush_rose",
		name: "Blush Rose",
		background: "#FDE8E8",
		text: "#5C2A2A",
		accent: "#F4A7A7",
	},
	{
		id: "lavender_mist",
		name: "Lavender Mist",
		background: "#F0ECF8",
		text: "#3B2A5A",
		accent: "#C3A8E8",
	},
	{
		id: "sage_and_cream",
		name: "Sage & Cream",
		background: "#EAF0E8",
		text: "#2C4A35",
		accent: "#8BBF8A",
	},
	{
		id: "hot_flamingo",
		name: "Hot Flamingo",
		background: "#FF6B9D",
		text: "#FFFFFF",
		accent: "#FFD6E8",
		lightBackground: "#FFD6E8",
		deep: "#C2185B",
	},
	{
		id: "cherry_red",
		name: "Cherry Red",
		background: "#FF4D6D",
		text: "#FFFFFF",
		accent: "#FFF0F3",
		lightBackground: "#FFF0F3",
		deep: "#800F2F",
	},
	{
		id: "candy_gradient",
		name: "Candy Gradient",
		background: "#FF6B9D",
		text: "#FFFFFF",
		accent: "#FFF5FB",
		lightBackground: "#FFF5FB",
		gradientStart: "#FF6B9D",
		gradientEnd: "#A855F7",
	},
	{
		id: "papaya_punch",
		name: "Papaya Punch",
		background: "#FF9A3C",
		text: "#FFFFFF",
		accent: "#FFF3E8",
		lightBackground: "#FFF3E8",
		deep: "#C75000",
	},
];

const LEGACY_THEME_MAP: Record<string, StorefrontThemeId> = {
	black: "midnight_berry",
	deep_blue: "electric_violet",
	green: "sage_and_cream",
	purple_blue: "lavender_mist",
};

export function hexToRgba(hex: string, alpha: number) {
	const normalized = hex.replace("#", "");
	const safeHex =
		normalized.length === 3
			? normalized
					.split("")
					.map((char) => `${char}${char}`)
					.join("")
			: normalized;

	const value = Number.parseInt(safeHex, 16);
	const r = (value >> 16) & 255;
	const g = (value >> 8) & 255;
	const b = value & 255;

	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getStorefrontTheme(themeId?: string | null) {
	const normalizedId =
		(themeId && LEGACY_THEME_MAP[themeId]) || themeId || "midnight_berry";
	return (
		STOREFRONT_THEMES.find((theme) => theme.id === normalizedId) ||
		STOREFRONT_THEMES.find((theme) => theme.id === "midnight_berry")!
	);
}

export function getStorefrontThemeStyles(themeId?: string | null) {
	const theme = getStorefrontTheme(themeId);
	const heroBackground =
		theme.gradientStart && theme.gradientEnd
			? `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`
			: `linear-gradient(135deg, ${theme.background} 0%, ${theme.deep || theme.text} 100%)`;

	return {
		theme,
		heroBackground,
		pageBackground: theme.lightBackground || hexToRgba(theme.background, 0.12),
		panelBackground: hexToRgba(theme.background, 0.1),
		elevatedPanelBackground: hexToRgba(theme.background, 0.14),
		softBorder: hexToRgba(theme.text, 0.14),
		strongBorder: hexToRgba(theme.text, 0.22),
		shadow: hexToRgba(theme.text, 0.18),
		mutedText: hexToRgba(theme.text, 0.78),
		buttonText: theme.deep || theme.text,
	};
}
