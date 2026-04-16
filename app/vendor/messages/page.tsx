"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { chatService, type ChatMessage } from "@/lib/services/chat.service";
import { toast } from "sonner";

const isWithinWindow = (createdAt: string) =>
  Date.now() - new Date(createdAt).getTime() <= 2 * 60 * 1000;

export default function VendorMessagesPage() {
  const [threads, setThreads] = useState<any[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [activeMarketUserId, setActiveMarketUserId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editingMessageText, setEditingMessageText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [chatDisabled, setChatDisabled] = useState(false);

  const activeThread = useMemo(
    () => threads.find((t) => t.marketUserId === activeMarketUserId),
    [threads, activeMarketUserId]
  );

  const loadThreads = useCallback(async () => {
    try {
      const response = await chatService.getVendorThreads();
      const payload = response.data.data;
      setThreads(payload.threads || []);
      setUnreadTotal(payload.unreadTotal || 0);
      if (!activeMarketUserId && payload.threads?.[0]?.marketUserId) {
        setActiveMarketUserId(payload.threads[0].marketUserId);
      }
    } catch (error: any) {
      if (error?.response?.status === 403) {
        setChatDisabled(true);
      } else {
        toast.error(error?.response?.data?.error?.message || "Failed to load messages");
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeMarketUserId]);

  const loadThread = useCallback(async (marketUserId: string) => {
    try {
      const response = await chatService.getVendorThread(marketUserId);
      const thread = response.data.data;
      setMessages(thread.messages || []);
      await chatService.markVendorRead(marketUserId);
      await loadThreads();
    } catch (error: any) {
      if (error?.response?.status === 403) {
        setChatDisabled(true);
      } else {
        toast.error(error?.response?.data?.error?.message || "Failed to open thread");
      }
    }
  }, [loadThreads]);

  useEffect(() => {
    if (chatDisabled) return;
    void loadThreads();
    const timer = setInterval(() => void loadThreads(), 12000);
    return () => clearInterval(timer);
  }, [chatDisabled, loadThreads]);

  useEffect(() => {
    if (!activeMarketUserId) return;
    void loadThread(activeMarketUserId);
  }, [activeMarketUserId, loadThread]);

  const send = async () => {
    if (!activeMarketUserId || !messageText.trim()) return;
    setIsSending(true);
    try {
      await chatService.sendVendorMessage(activeMarketUserId, messageText.trim());
      setMessageText("");
      await loadThread(activeMarketUserId);
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const saveEdit = async () => {
    if (!activeMarketUserId || !editingMessageId || !editingMessageText.trim()) return;
    try {
      await chatService.editVendorMessage(
        activeMarketUserId,
        editingMessageId,
        editingMessageText.trim()
      );
      setEditingMessageId("");
      setEditingMessageText("");
      await loadThread(activeMarketUserId);
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || "Failed to edit message");
    }
  };

  const removeMessage = async (messageId: string) => {
    if (!activeMarketUserId) return;
    try {
      await chatService.deleteVendorMessage(activeMarketUserId, messageId);
      await loadThread(activeMarketUserId);
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || "Failed to delete message");
    }
  };

  return (
    <ProtectedRoute allowedRoles={["vendor"]}>
      <DashboardLayout userRole="vendor">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Private Messages</h1>
            <p className="text-muted-foreground">
              Unread notifications: {unreadTotal}
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-8 w-8" />
            </div>
          ) : chatDisabled ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-sm text-muted-foreground">
                  Chat is currently disabled by the Super Admin.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Conversations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {threads.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No conversations yet.</p>
                  ) : (
                    threads.map((thread) => (
                      <button
                        key={thread.marketUserId}
                        type="button"
                        onClick={() => setActiveMarketUserId(thread.marketUserId)}
                        className={`w-full rounded-lg border p-3 text-left transition ${
                          activeMarketUserId === thread.marketUserId
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{thread.marketUserName || "User"}</p>
                          {thread.unreadCount > 0 && (
                            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                              {thread.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {thread.lastMessage?.deletedAt ? "Message deleted" : thread.lastMessage?.text}
                        </p>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>{activeThread?.marketUserName || "Select a conversation"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="h-[420px] space-y-3 overflow-y-auto rounded-md border bg-muted/20 p-3">
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                          message.senderType === "vendor"
                            ? "ml-auto bg-primary text-primary-foreground"
                            : "bg-background border"
                        }`}
                      >
                        {message.deletedAt ? (
                          <span className="italic opacity-70">Message deleted</span>
                        ) : (
                          <p>{message.text}</p>
                        )}
                        {message.senderType === "vendor" &&
                          !message.deletedAt &&
                          isWithinWindow(message.createdAt) && (
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
                    ))}
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
                        placeholder="Type your reply..."
                        disabled={!activeMarketUserId}
                      />
                      <Button onClick={send} disabled={isSending || !activeMarketUserId}>
                        {isSending ? "Sending..." : "Send"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
