import { apiClient } from "@/lib/api-client";
import { getMarketUserHeaders } from "@/lib/market-user";
import type { ApiResponse } from "@/lib/types";

export interface ReviewItem {
  id: string;
  rating: number;
  feedback: string;
  marketUserName?: string;
  createdAt: string;
}

export const reviewService = {
  async listVendorReviews(vendorMongoId: string) {
    return apiClient.get<ApiResponse<{ reviews: ReviewItem[]; summary: { count: number; averageRating: number } }>>(
      `/reviews/vendor/${vendorMongoId}`
    );
  },

  async listProductReviews(productMongoId: string) {
    return apiClient.get<ApiResponse<{ reviews: ReviewItem[]; summary: { count: number; averageRating: number } }>>(
      `/reviews/product/${productMongoId}`
    );
  },

  async submitVendorReview(vendorMongoId: string, rating: number, feedback: string) {
    return apiClient.post<ApiResponse<ReviewItem>>(
      `/reviews/vendor/${vendorMongoId}`,
      { rating, feedback },
      { headers: getMarketUserHeaders() }
    );
  },

  async submitProductReview(productMongoId: string, rating: number, feedback: string) {
    return apiClient.post<ApiResponse<ReviewItem>>(
      `/reviews/product/${productMongoId}`,
      { rating, feedback },
      { headers: getMarketUserHeaders() }
    );
  },
};
