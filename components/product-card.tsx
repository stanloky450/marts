import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
	const displayPrice = product.discountPrice || product.price;

	return (
		<div className="group flex flex-col justify-between bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
			<Link href={`/products/${product._id}`} className="block relative aspect-square bg-slate-100 overflow-hidden">
				{product.images?.[0] ? (
					<Image
						src={product.images[0]}
						alt={product.name}
						fill
						className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center text-slate-400">No Image</div>
				)}
			</Link>
			<div className="p-4 flex flex-col gap-2">
				<Link href={`/products/${product._id}`} className="block">
					<h3 className="font-medium text-slate-700 text-sm line-clamp-1 group-hover:text-primary transition-colors">
						{product.name}
					</h3>
				</Link>
				<div className="flex items-center gap-2">
					<span className="font-bold text-green-600">
						NGN {displayPrice.toLocaleString()}
					</span>
					{product.discountPrice && (
						<span className="text-xs text-slate-400 line-through">
							NGN {product.price.toLocaleString()}
						</span>
					)}
				</div>
				<Button className="w-full mt-2 rounded-full font-semibold" size="sm">
					Buy Now
				</Button>
			</div>
		</div>
	);
}

