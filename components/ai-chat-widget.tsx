"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Message01Icon,
	Cancel01Icon,
	AiChat01Icon,
	ShoppingBag01Icon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";

interface Product {
	_id: string;
	name: string;
	price: number;
	stock: number;
	images?: string[];
	description?: string;
	vendor?: { businessName: string; subdomain?: string };
}

interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	products?: Product[];
	timestamp: Date;
}

interface AIChatWidgetProps {
	subdomain?: string;
	storeContext?: string;
}

export function AIChatWidget({ subdomain, storeContext }: AIChatWidgetProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [messages, setMessages] = useState<Message[]>([
		{
			id: "welcome",
			role: "assistant",
			content: subdomain
				? "👋 Hi! I'm your personal shopping assistant. Ask me about our products, prices, or help you find the perfect item!"
				: "👋 Hi! I'm your AI shopping assistant. Tell me what you're looking for and I'll find the best products for you!",
			timestamp: new Date(),
		},
	]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isOpen) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
			setTimeout(() => inputRef.current?.focus(), 300);
		}
	}, [messages, isOpen]);

	const sendMessage = async () => {
		const text = input.trim();
		if (!text || isLoading) return;

		const userMsg: Message = {
			id: Date.now().toString(),
			role: "user",
			content: text,
			timestamp: new Date(),
		};

		setMessages((prev) => [...prev, userMsg]);
		setInput("");
		setIsLoading(true);

		try {
			const response = await apiClient.post<{
				success: boolean;
				data: { reply: string; products: Product[] };
			}>("/ai/chat", {
				message: text,
				subdomain,
				context: storeContext,
			});

			const { reply, products } = response.data.data;

			setMessages((prev) => [
				...prev,
				{
					id: (Date.now() + 1).toString(),
					role: "assistant",
					content: reply,
					products: products?.length ? products : undefined,
					timestamp: new Date(),
				},
			]);
		} catch (err) {
			console.error("[AI Chat] Request failed:", err);
			setMessages((prev) => [
				...prev,
				{
					id: (Date.now() + 1).toString(),
					role: "assistant",
					content:
						"Sorry, I'm having trouble connecting right now. Please try again in a moment!",
					timestamp: new Date(),
				},
			]);
		} finally {
			setIsLoading(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	};

	const quickQuestions = [
		"What's popular right now?",
		"Show me affordable options",
		"Best value products?",
	];

	return (
		<>
			{/* Floating Button */}
			<motion.button
				onClick={() => setIsOpen(true)}
				className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/40 transition-transform hover:scale-105 active:scale-95 ${isOpen ? "hidden" : ""}`}
				initial={{ scale: 0, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ delay: 1, type: "spring" }}
				aria-label="Open AI chat assistant"
			>
				<HugeiconsIcon icon={Message01Icon} className="h-6 w-6" />
				{/* Pulse ring */}
				<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-20" />
			</motion.button>

			{/* Chat Window */}
			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ opacity: 0, y: 40, scale: 0.95 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 40, scale: 0.95 }}
						transition={{ type: "spring", damping: 22, stiffness: 300 }}
						className="fixed bottom-6 right-6 z-50 flex w-[370px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/20 ring-1 ring-black/5"
						style={{ height: "560px" }}
					>
						{/* Header */}
						<div className="flex items-center justify-between bg-gradient-to-r from-violet-600 to-indigo-700 px-4 py-3 text-white">
							<div className="flex items-center gap-2.5">
								<div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
									<HugeiconsIcon icon={AiChat01Icon} className="h-5 w-5" />
								</div>
								<div>
									<p className="text-sm font-semibold leading-tight">
										AI Shopping Assistant
									</p>
									<p className="text-xs opacity-80">
										Sales-focused · Powered by QuikZone
									</p>
								</div>
							</div>
							<button
								onClick={() => setIsOpen(false)}
								className="rounded-lg p-1.5 opacity-80 transition-opacity hover:opacity-100 hover:bg-white/10"
								aria-label="Close chat"
							>
								<HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
							</button>
						</div>

						{/* Messages */}
						<div className="flex-1 space-y-4 overflow-y-auto bg-gray-50/50 p-4">
							{messages.map((msg) => (
								<div
									key={msg.id}
									className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
								>
									<div
										className={`max-w-[85%] ${msg.role === "user" ? "order-2" : "order-1 flex items-start gap-2"}`}
									>
										{msg.role === "assistant" && (
											<div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
												<HugeiconsIcon
													icon={AiChat01Icon}
													className="h-3.5 w-3.5"
												/>
											</div>
										)}
										<div>
											<div
												className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
													msg.role === "user"
														? "rounded-tr-sm bg-gradient-to-br from-violet-600 to-indigo-600 text-white"
														: "rounded-tl-sm bg-white text-gray-800"
												}`}
											>
												{msg.content}
											</div>

											{/* Product Recommendation Cards */}
											{msg.products && msg.products.length > 0 && (
												<div className="mt-2 space-y-2">
													{msg.products.map((product) => {
														const storeLink = product.vendor?.subdomain
															? `/store/${product.vendor.subdomain}/products/${product._id}`
															: "#";
														return (
															<Link
																key={product._id}
																href={storeLink}
																className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
															>
																<div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
																	{product.images?.[0] ? (
																		<img
																			src={product.images[0]}
																			alt={product.name}
																			className="h-full w-full object-cover transition-transform group-hover:scale-105"
																		/>
																	) : (
																		<div className="flex h-full items-center justify-center">
																			<HugeiconsIcon
																				icon={ShoppingBag01Icon}
																				className="h-5 w-5 text-gray-400"
																			/>
																		</div>
																	)}
																</div>
																<div className="min-w-0 flex-1">
																	<p className="truncate text-sm font-semibold text-gray-900 group-hover:text-indigo-600">
																		{product.name}
																	</p>
																	<p className="text-xs text-gray-500">
																		{product.vendor?.businessName}
																	</p>
																	<div className="mt-1 flex items-center gap-2">
																		<span className="text-sm font-bold text-indigo-700">
																			₦{product.price.toLocaleString()}
																		</span>
																		{product.stock <= 5 &&
																			product.stock > 0 && (
																				<span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
																					Only {product.stock} left!
																				</span>
																			)}
																	</div>
																</div>
															</Link>
														);
													})}
												</div>
											)}
										</div>
									</div>
								</div>
							))}

							{/* Typing indicator */}
							{isLoading && (
								<div className="flex items-start gap-2">
									<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
										<HugeiconsIcon
											icon={AiChat01Icon}
											className="h-3.5 w-3.5"
										/>
									</div>
									<div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm">
										<span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.3s]" />
										<span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.15s]" />
										<span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" />
									</div>
								</div>
							)}

							<div ref={messagesEndRef} />
						</div>

						{/* Quick questions (shown when only welcome message) */}
						{messages.length === 1 && !isLoading && (
							<div className="border-t border-gray-100 bg-white px-4 py-2">
								<p className="mb-2 text-xs font-medium text-gray-400">
									Quick questions
								</p>
								<div className="flex flex-wrap gap-1.5">
									{quickQuestions.map((q) => (
										<button
											key={q}
											onClick={() => {
												setInput(q);
												inputRef.current?.focus();
											}}
											className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
										>
											{q}
										</button>
									))}
								</div>
							</div>
						)}

						{/* Input */}
						<div className="border-t border-gray-100 bg-white p-3">
							<div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 transition-colors focus-within:border-indigo-400 focus-within:bg-white">
								<input
									ref={inputRef}
									type="text"
									value={input}
									onChange={(e) => setInput(e.target.value)}
									onKeyDown={handleKeyDown}
									placeholder="Ask about products..."
									className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
									disabled={isLoading}
									maxLength={500}
								/>
								<button
									onClick={sendMessage}
									disabled={!input.trim() || isLoading}
									className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
									aria-label="Send message"
								>
									{/* {isLoading ? (
                    <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <HugeiconsIcon icon={Sent01Icon} className="h-3.5 w-3.5" />
                  )} */}
								</button>
							</div>
							<p className="mt-1.5 text-center text-[10px] text-gray-400">
								AI-powered sales assistant · Not for customer support
							</p>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}

