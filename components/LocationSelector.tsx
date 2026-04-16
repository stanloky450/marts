"use client";
import { useState, useEffect } from "react";
import { locationService, type Location } from "@/lib/services/location.service";

export default function LocationSelector({
	onLocationChange,
	initialRegion,
	initialArea,
}: {
	onLocationChange?: (location: { region: string; area: string; registrationFee?: number }) => void;
	initialRegion?: string;
	initialArea?: string;
}) {
	const [region, setRegion] = useState(initialRegion || "");
	const [area, setArea] = useState(initialArea || "");
	const [areasList, setAreasList] = useState<string[]>([]);
	const [dbLocations, setDbLocations] = useState<Location[]>([]);

	useEffect(() => {
		const loadLocations = async () => {
			try {
				const response = await locationService.getLocations({ activeOnly: true });
				const data = response.data.data;
				setDbLocations(Array.isArray(data) ? data : []);
			} catch (error) {
				console.error("Failed to load locations", error);
			}
		};
		loadLocations();
	}, []);

	useEffect(() => {
		if (region && dbLocations.length > 0) {
			const locObj = dbLocations.find(l => l.region === region);
			if (locObj) {
				setAreasList(locObj.areas || []);
			} else {
				setAreasList([]);
			}
			
			// Only reset area if the newly selected region doesn't contain the current area
			if (locObj && !locObj.areas?.includes(area)) {
				setArea("");
			}
		} else {
			setAreasList([]);
		}
	}, [region, dbLocations]);

	useEffect(() => {
		if (onLocationChange) {
			const locObj = dbLocations.find(l => l.region === region);
			onLocationChange({ 
				region, 
				area, 
				registrationFee: locObj?.registrationFee 
			});
		}
	}, [region, area, dbLocations]);

	return (
		<div className="flex flex-col gap-4">
			{/* REGION */}
			<div>
				<label className="block mb-1 font-medium">Region</label>
				<select
					value={region}
					onChange={(e) => setRegion(e.target.value)}
					className="w-full p-2 border rounded"
				>
					<option value="">Select Region</option>
					{dbLocations.map((loc) => (
						<option key={loc._id || loc.region} value={loc.region}>
							{loc.region}
						</option>
					))}
				</select>
			</div>

			{/* AREA */}
			<div>
				<label className="block mb-1 font-medium">Area</label>
				<select
					value={area}
					onChange={(e) => setArea(e.target.value)}
					className="w-full p-2 border rounded"
					disabled={!region}
				>
					<option value="">Select Area</option>
					{areasList.map((a) => (
						<option key={a} value={a}>
							{a}
						</option>
					))}
				</select>
			</div>
		</div>
	);
}
