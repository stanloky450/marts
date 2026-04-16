"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { apiClient } from "@/lib/api-client"
import type { User, Vendor, AuthResponse, ApiResponse } from "@/lib/types"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface AuthContextType {
  user: User | null
  vendor: Vendor | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const refreshUser = useCallback(async () => {
    try {
      const response = await apiClient.get<ApiResponse<{ user: User; vendor?: Vendor }>>("/auth/me")
      setUser(response.data.data.user)
      setVendor(response.data.data.vendor || null)
    } catch (error) {
      console.error("[v0] Failed to refresh user:", error)
      setUser(null)
      setVendor(null)
    }
  }, [])

  useEffect(() => {
    const initAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null

      if (token) {
        await refreshUser()
      }

      setIsLoading(false)
    }

    initAuth()
  }, [refreshUser])

  const login = async (email: string, password: string) => {
    try {
      const response = await apiClient.post<ApiResponse<AuthResponse>>("/auth/login", {
        email,
        password,
      })

      const { user, vendor, accessToken, refreshToken } = response.data.data

      apiClient.setTokens(accessToken, refreshToken)
      setUser(user)
      setVendor(vendor || null)

      toast.success("Login successful")

      // Redirect based on role
      if (user.role === "super_admin") {
        router.push("/super-admin")
      } else if (user.role === "admin") {
        router.push("/admin")
      } else if (user.role === "vendor") {
        router.push("/vendor")
      }
    } catch (error: unknown) {
      console.error("[v0] Login error:", error)
      const errorMessage = error instanceof Error ? error.message : "Login failed"
      toast.error(errorMessage)
      throw error
    }
  }

  const logout = async () => {
    try {
      await apiClient.post("/auth/logout")
    } catch (error) {
      console.error("[v0] Logout error:", error)
    } finally {
      setUser(null)
      setVendor(null)
      if (typeof window !== "undefined") {
        localStorage.removeItem("accessToken")
        localStorage.removeItem("refreshToken")
      }
      router.push("/login")
      toast.success("Logged out successfully")
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        vendor,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
