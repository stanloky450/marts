"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type ThemeName = "black" | "deep_blue" | "green" | "purple_blue" | "purple";

export const THEME_OPTIONS: { value: ThemeName; label: string; color: string }[] = [
	{ value: "black", label: "Black", color: "#000000" },
	{ value: "deep_blue", label: "Deep Blue", color: "#0000D1" },
	{ value: "green", label: "Green", color: "#0F4D0F" },
	{ value: "purple_blue", label: "Bluish Purple", color: "#6F3CE8" },
	{ value: "purple", label: "Purple", color: "#4A289A" },
];

interface ThemeContextType {
	theme: ThemeName;
	setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType>({
	theme: "black",
	setTheme: () => {},
});

const STORAGE_KEY = "app-theme";

export function CustomThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = useState<ThemeName>("black");

	// Load saved theme on mount
	useEffect(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY) as ThemeName | null;
			if (saved && THEME_OPTIONS.some((t) => t.value === saved)) {
				setThemeState(saved);
				document.documentElement.setAttribute("data-theme", saved);
			} else {
				document.documentElement.setAttribute("data-theme", "black");
			}
		} catch {
			document.documentElement.setAttribute("data-theme", "black");
		}
	}, []);

	const setTheme = useCallback((newTheme: ThemeName) => {
		setThemeState(newTheme);
		try {
			localStorage.setItem(STORAGE_KEY, newTheme);
		} catch {
			// localStorage unavailable
		}
		document.documentElement.setAttribute("data-theme", newTheme);
	}, []);

	return (
		<ThemeContext.Provider value={{ theme, setTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	return useContext(ThemeContext);
}

