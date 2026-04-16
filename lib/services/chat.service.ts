import { apiClient } from "@/lib/api-client";
import { getMarketUserHeaders } from "@/lib/market-user";
import type { ApiResponse } from "@/lib/types";

export interface ChatMessage {
  id: string;
  senderType: "user" | "vendor";
  senderId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  edited?: boolean;
  deletedAt?: string | null;
}

export interface ChatThread {
  vendorMongoId: string;
  marketUserId: string;
  marketUserName?: string;
  marketUserEmail?: string;
  messages: ChatMessage[];
  userLastReadAt?: string | null;
  vendorLastReadAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const chatService = {
  async getUserThread(vendorMongoId: string) {
    return apiClient.get<ApiResponse<ChatThread>>(`/chat/user/thread/${vendorMongoId}`, {
      headers: getMarketUserHeaders(),
    });
  },

  async getUserThreads() {
    return apiClient.get<ApiResponse<{ threads: any[]; unreadTotal: number }>>(
      "/chat/user/threads",
      { headers: getMarketUserHeaders() }
    );
  },

  async sendUserMessage(vendorMongoId: string, text: string) {
    return apiClient.post<ApiResponse<ChatMessage>>(
      `/chat/user/thread/${vendorMongoId}/messages`,
      { text },
      { headers: getMarketUserHeaders() }
    );
  },

  async editUserMessage(vendorMongoId: string, messageId: string, text: string) {
    return apiClient.patch<ApiResponse<ChatMessage>>(
      `/chat/user/thread/${vendorMongoId}/messages/${messageId}`,
      { text },
      { headers: getMarketUserHeaders() }
    );
  },

  async deleteUserMessage(vendorMongoId: string, messageId: string) {
    return apiClient.delete<ApiResponse<{ id: string }>>(
      `/chat/user/thread/${vendorMongoId}/messages/${messageId}`,
      { headers: getMarketUserHeaders() }
    );
  },

  async markUserRead(vendorMongoId: string) {
    return apiClient.post<ApiResponse<{ ok: boolean }>>(
      `/chat/user/thread/${vendorMongoId}/read`,
      {},
      { headers: getMarketUserHeaders() }
    );
  },

  async getVendorThreads() {
    return apiClient.get<ApiResponse<{ threads: any[]; unreadTotal: number }>>(
      "/chat/vendor/threads"
    );
  },

  async getVendorThread(marketUserId: string) {
    return apiClient.get<ApiResponse<ChatThread>>(`/chat/vendor/thread/${marketUserId}`);
  },

  async sendVendorMessage(marketUserId: string, text: string) {
    return apiClient.post<ApiResponse<ChatMessage>>(
      `/chat/vendor/thread/${marketUserId}/messages`,
      { text }
    );
  },

  async editVendorMessage(marketUserId: string, messageId: string, text: string) {
    return apiClient.patch<ApiResponse<ChatMessage>>(
      `/chat/vendor/thread/${marketUserId}/messages/${messageId}`,
      { text }
    );
  },

  async deleteVendorMessage(marketUserId: string, messageId: string) {
    return apiClient.delete<ApiResponse<{ id: string }>>(
      `/chat/vendor/thread/${marketUserId}/messages/${messageId}`
    );
  },

  async markVendorRead(marketUserId: string) {
    return apiClient.post<ApiResponse<{ ok: boolean }>>(
      `/chat/vendor/thread/${marketUserId}/read`,
      {}
    );
  },
};
