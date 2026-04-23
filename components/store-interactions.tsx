"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { chatService, type ChatMessage } from "@/lib/services/chat.service";
import { reviewService } from "@/lib/services/review.service";
import { settingService } from "@/lib/services/setting.service";
import {
  MARKET_USER_EVENT,
  readMarketUserRegistration,
  validateMarketUserSession,
} from "@/lib/market-user";

interface StoreInteractionsProps {
  vendorMongoId: string;
  productMongoId: string;
}

const isWithinWindow = (createdAt: string) =>
  Date.now() - new Date(createdAt).getTime() <= 2 * 60 * 1000;

export function StoreInteractions({
  vendorMongoId,
  productMongoId,
}: StoreInteractionsProps) {
  const [chatEnabled, setChatEnabled] = useState(true);
  const [reviewsEnabled, setReviewsEnabled] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editingMessageText, setEditingMessageText] = useState("");
  const [unreadForVendor, setUnreadForVendor] = useState(0);
  const [isSending, setIsSending] = useState(false);

  const [vendorRating, setVendorRating] = useState(5);
  const [vendorFeedback, setVendorFeedback] = useState("");
  const [productRating, setProductRating] = useState(5);
  const [productFeedback, setProductFeedback] = useState("");
  const [vendorReviewPayload, setVendorReviewPayload] = useState<any>(null);
  const [productReviewPayload, setProductReviewPayload] = useState<any>(null);
  const [canChatOrReview, setCanChatOrReview] = useState(false);

  useEffect(() => {
    const syncMarketUser = () => {
      void validateMarketUserSession().then((marketUser) => {
        setCanChatOrReview(!!marketUser);
      });
    };

    setCanChatOrReview(!!readMarketUserRegistration());
    syncMarketUser();
    window.addEventListener(MARKET_USER_EVENT, syncMarketUser);
    window.addEventListener("storage", syncMarketUser);

    return () => {
      window.removeEventListener(MARKET_USER_EVENT, syncMarketUser);
      window.removeEventListener("storage", syncMarketUser);
    };
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const response = await settingService.getPublicSettings();
      const s = response.data.data || {};
      setChatEnabled(s.feature_chat_enabled !== false);
      setReviewsEnabled(s.feature_reviews_enabled !== false);
    } catch {
      setChatEnabled(true);
      setReviewsEnabled(true);
    } finally {
      setSettingsLoaded(true);
    }
  }, []);

  const loadThread = useCallback(async () => {
    if (!settingsLoaded || !canChatOrReview || !chatEnabled) return;
    try {
      const response = await chatService.getUserThread(vendorMongoId);
      setMessages(response.data.data.messages || []);
      await chatService.markUserRead(vendorMongoId);
      const threadsResponse = await chatService.getUserThreads();
      const found =
        threadsResponse.data.data.threads?.find(
          (t: any) => t.vendor?.mongoId === vendorMongoId
        ) || null;
      setUnreadForVendor(found?.unreadCount || 0);
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(error?.response?.data?.error?.message || "Failed to load chat");
      }
    }
  }, [settingsLoaded, canChatOrReview, chatEnabled, vendorMongoId]);

  const loadReviews = useCallback(async () => {
    if (!settingsLoaded || !reviewsEnabled) return;
    try {
      const [vendorRes, productRes] = await Promise.all([
        reviewService.listVendorReviews(vendorMongoId),
        reviewService.listProductReviews(productMongoId),
      ]);
      setVendorReviewPayload(vendorRes.data.data);
      setProductReviewPayload(productRes.data.data);
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error("Failed to load reviews");
      }
    }
  }, [settingsLoaded, reviewsEnabled, vendorMongoId, productMongoId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    void loadThread();
    if (!settingsLoaded || !chatEnabled || !canChatOrReview) return;
    const timer = setInterval(() => void loadThread(), 12000);
    return () => clearInterval(timer);
  }, [loadThread, settingsLoaded, chatEnabled, canChatOrReview]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const send = async () => {
    if (!messageText.trim()) return;
    setIsSending(true);
    try {
      await chatService.sendUserMessage(vendorMongoId, messageText.trim());
      setMessageText("");
      await loadThread();
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const saveEdit = async () => {
    if (!editingMessageId || !editingMessageText.trim()) return;
    try {
      await chatService.editUserMessage(
        vendorMongoId,
        editingMessageId,
        editingMessageText.trim()
      );
      setEditingMessageId("");
      setEditingMessageText("");
      await loadThread();
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || "Failed to edit message");
    }
  };

  const removeMessage = async (messageId: string) => {
    try {
      await chatService.deleteUserMessage(vendorMongoId, messageId);
      await loadThread();
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || "Failed to delete message");
    }
  };

  const submitVendorReview = async () => {
    try {
      await reviewService.submitVendorReview(
        vendorMongoId,
        vendorRating,
        vendorFeedback
      );
      setVendorFeedback("");
      await loadReviews();
      toast.success("Vendor review submitted");
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || "Failed to submit review");
    }
  };

  const submitProductReview = async () => {
    try {
      await reviewService.submitProductReview(
        productMongoId,
        productRating,
        productFeedback
      );
      setProductFeedback("");
      await loadReviews();
      toast.success("Product review submitted");
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || "Failed to submit review");
    }
  };

  const myMessages = useMemo(
    () => messages.filter((m) => m.senderType === "user"),
    [messages]
  );

  return (
    <div className="space-y-6">
      {chatEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Private Chat</span>
              {unreadForVendor > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                  {unreadForVendor} new
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!canChatOrReview ? (
              <p className="text-sm text-muted-foreground">
                Login as a user or complete user registration to chat with this vendor.
              </p>
            ) : (
              <>
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-3">
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No messages yet.</p>
                  ) : (
                    messages.map((message) => {
                      const canMutate =
                        message.senderType === "user" &&
                        !message.deletedAt &&
                        isWithinWindow(message.createdAt);
                      return (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`rounded-xl px-3 py-2 text-sm ${
                            message.senderType === "user"
                              ? "ml-auto max-w-[80%] bg-primary text-primary-foreground"
                              : "max-w-[80%] border bg-background"
                          }`}
                        >
                          {message.deletedAt ? (
                            <span className="italic opacity-70">Message deleted</span>
                          ) : (
                            <p>{message.text}</p>
                          )}
                          {canMutate && (
                            <div className="mt-2 flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setEditingMessageId(message.id);
                                  setEditingMessageText(message.text);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => void removeMessage(message.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          )}
                        </motion.div>
                      );
                    })
                  )}
                </div>
                {editingMessageId ? (
                  <div className="space-y-2">
                    <Input
                      value={editingMessageText}
                      onChange={(e) => setEditingMessageText(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void saveEdit()}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingMessageId("");
                          setEditingMessageText("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type your private message..."
                    />
                    <Button disabled={isSending} onClick={() => void send()}>
                      {isSending ? "Sending..." : "Send"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {reviewsEnabled && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>
                Vendor Reviews ({vendorReviewPayload?.summary?.count || 0}) ·{" "}
                {vendorReviewPayload?.summary?.averageRating || 0}/5
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canChatOrReview && (
                <>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={vendorRating}
                    onChange={(e) => setVendorRating(Number(e.target.value))}
                  />
                  <Textarea
                    value={vendorFeedback}
                    onChange={(e) => setVendorFeedback(e.target.value)}
                    placeholder="Share your feedback about this vendor..."
                  />
                  <Button onClick={() => void submitVendorReview()}>Submit Vendor Review</Button>
                </>
              )}
              {(vendorReviewPayload?.reviews || []).slice(0, 5).map((review: any) => (
                <div key={review.id} className="rounded-md border p-2 text-sm">
                  <p className="font-medium">{review.marketUserName || "User"} · {review.rating}/5</p>
                  <p className="text-muted-foreground">{review.feedback}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Product Reviews ({productReviewPayload?.summary?.count || 0}) ·{" "}
                {productReviewPayload?.summary?.averageRating || 0}/5
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canChatOrReview && (
                <>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={productRating}
                    onChange={(e) => setProductRating(Number(e.target.value))}
                  />
                  <Textarea
                    value={productFeedback}
                    onChange={(e) => setProductFeedback(e.target.value)}
                    placeholder="Share your feedback about this product..."
                  />
                  <Button onClick={() => void submitProductReview()}>
                    Submit Product Review
                  </Button>
                </>
              )}
              {(productReviewPayload?.reviews || []).slice(0, 5).map((review: any) => (
                <div key={review.id} className="rounded-md border p-2 text-sm">
                  <p className="font-medium">{review.marketUserName || "User"} · {review.rating}/5</p>
                  <p className="text-muted-foreground">{review.feedback}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {chatEnabled && canChatOrReview && myMessages.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Messages can only be edited/deleted within 2 minutes of sending.
        </p>
      )}
    </div>
  );
}
