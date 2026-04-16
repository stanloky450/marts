import axios, {
	type AxiosInstance,
	type AxiosError,
	type InternalAxiosRequestConfig,
} from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

class ApiClient {
	private client: AxiosInstance;

	constructor() {
		this.client = axios.create({
			baseURL: API_BASE_URL,
			headers: {
				"Content-Type": "application/json",
			},
			withCredentials: true,
		});

		this.setupInterceptors();
	}

	private setupInterceptors() {
		// Request interceptor - add auth token
		this.client.interceptors.request.use(
			(config: InternalAxiosRequestConfig) => {
				const token = this.getAccessToken();
				if (token && config.headers) {
					config.headers.Authorization = `Bearer ${token}`;
				}
				return config;
			},
			(error: AxiosError) => Promise.reject(error)
		);

		// Response interceptor - handle token refresh
		this.client.interceptors.response.use(
			(response) => response,
			async (error: AxiosError) => {
				const originalRequest = error.config as InternalAxiosRequestConfig & {
					_retry?: boolean;
				};

				if (error.response?.status === 401 && !originalRequest._retry) {
					originalRequest._retry = true;

					try {
						const refreshToken = this.getRefreshToken();
						if (!refreshToken) {
							throw new Error("No refresh token");
						}

						const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
							refreshToken,
						});

						const { accessToken } = response.data.data;
						this.setAccessToken(accessToken);

						if (originalRequest.headers) {
							originalRequest.headers.Authorization = `Bearer ${accessToken}`;
						}

						return this.client(originalRequest);
					} catch (refreshError) {
						this.clearTokens();
						if (typeof window !== "undefined") {
							window.location.href = "/login";
						}
						return Promise.reject(refreshError);
					}
				}

				return Promise.reject(error);
			}
		);
	}

	private getAccessToken(): string | null {
		if (typeof window === "undefined") return null;
		return localStorage.getItem("accessToken");
	}

	private getRefreshToken(): string | null {
		if (typeof window === "undefined") return null;
		return localStorage.getItem("refreshToken");
	}

	private setAccessToken(token: string): void {
		if (typeof window !== "undefined") {
			localStorage.setItem("accessToken", token);
		}
	}

	private clearTokens(): void {
		if (typeof window !== "undefined") {
			localStorage.removeItem("accessToken");
			localStorage.removeItem("refreshToken");
		}
	}

	public setTokens(accessToken: string, refreshToken: string): void {
		if (typeof window !== "undefined") {
			localStorage.setItem("accessToken", accessToken);
			localStorage.setItem("refreshToken", refreshToken);
		}
	}

	public get<T>(url: string, config = {}) {
		return this.client.get<T>(url, config);
	}

	public post<T>(url: string, data?: unknown, config = {}) {
		return this.client.post<T>(url, data, config);
	}

	public put<T>(url: string, data?: unknown, config = {}) {
		return this.client.put<T>(url, data, config);
	}

	public patch<T>(url: string, data?: unknown, config = {}) {
		return this.client.patch<T>(url, data, config);
	}

	public delete<T>(url: string, config = {}) {
		return this.client.delete<T>(url, config);
	}

	public uploadFile<T>(
		url: string,
		formData: FormData,
		onProgress?: (progress: number) => void
	) {
		return this.client.post<T>(url, formData, {
			headers: {
				"Content-Type": "multipart/form-data",
			},
			onUploadProgress: (progressEvent) => {
				if (onProgress && progressEvent.total) {
					const progress = Math.round(
						(progressEvent.loaded * 100) / progressEvent.total
					);
					onProgress(progress);
				}
			},
		});
	}
}

export const apiClient = new ApiClient();
