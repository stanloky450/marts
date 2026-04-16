"use client";

import { useTheme, THEME_OPTIONS, type ThemeName } from "@/contexts/theme-context";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeSwitcher() {
	const { theme, setTheme } = useTheme();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="w-full justify-start gap-2 bg-transparent">
					<Palette className="h-4 w-4" />
					<span className="text-sm">Theme</span>
					<span
						className="ml-auto h-4 w-4 rounded-full border border-white/20"
						style={{ backgroundColor: THEME_OPTIONS.find((t) => t.value === theme)?.color }}
					/>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				{THEME_OPTIONS.map((option) => (
					<DropdownMenuItem
						key={option.value}
						onClick={() => setTheme(option.value)}
						className={cn(
							"flex items-center gap-3 cursor-pointer",
							theme === option.value && "bg-accent"
						)}
					>
						<span
							className="h-5 w-5 rounded-full border-2 shrink-0"
							style={{
								backgroundColor: option.color,
								borderColor: theme === option.value ? "white" : "transparent",
								boxShadow: theme === option.value ? `0 0 0 2px ${option.color}` : "none",
							}}
						/>
						<span className="text-sm font-medium">{option.label}</span>
						{theme === option.value && (
							<svg className="ml-auto h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
								<polyline points="20 6 9 17 4 12" />
							</svg>
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
