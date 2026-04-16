"use client";

import {
	Area,
	AreaChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, parseISO } from "date-fns";

interface RevenueChartProps {
	data: {
		date: string;
		revenue: number;
	}[];
}

export function RevenueChart({ data }: RevenueChartProps) {
	if (!data || data.length === 0) {
		return (
			<Card className="col-span-4">
				<CardHeader>
					<CardTitle>Revenue Overview</CardTitle>
				</CardHeader>
				<CardContent className="flex h-[350px] items-center justify-center text-muted-foreground">
					No active data found
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="col-span-4">
			<CardHeader>
				<CardTitle>Revenue Overview (Last 30 Days)</CardTitle>
			</CardHeader>
			<CardContent className="pl-2">
				<div className="h-[350px] w-full mt-4">
					<ResponsiveContainer width="100%" height="100%">
						<AreaChart data={data}>
							<defs>
								<linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
									<stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
								</linearGradient>
							</defs>
							<XAxis
								dataKey="date"
								stroke="#888888"
								fontSize={12}
								tickLine={false}
								axisLine={false}
								tickFormatter={(value) => {
									try {
										return format(parseISO(value), "MMM d");
									} catch {
										return value;
									}
								}}
							/>
							<YAxis
								stroke="#888888"
								fontSize={12}
								tickLine={false}
								axisLine={false}
								tickFormatter={(value) => `₦${value.toLocaleString()}`}
							/>
							<Tooltip
								content={({ active, payload, label }) => {
									if (active && payload && payload.length) {
										const formattedDate = format(parseISO(label), "MMM d, yyyy");
										return (
											<div className="rounded-lg border bg-background p-2 shadow-sm">
												<div className="grid grid-cols-2 gap-2">
													<div className="flex flex-col">
														<span className="text-[0.70rem] uppercase text-muted-foreground">
															{formattedDate}
														</span>
														<span className="font-bold text-muted-foreground">
															Revenue: ₦{payload[0].value?.toLocaleString()}
														</span>
													</div>
												</div>
											</div>
										);
									}
									return null;
								}}
							/>
							<Area
								type="monotone"
								dataKey="revenue"
								stroke="#8884d8"
								fillOpacity={1}
								fill="url(#colorRevenue)"
							/>
						</AreaChart>
					</ResponsiveContainer>
				</div>
			</CardContent>
		</Card>
	);
}
