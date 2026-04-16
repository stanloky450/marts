"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/auth-context"
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Store,
  Megaphone,
  Settings,
  LogOut,
  Menu,
  UserCog,
  Gift,
  ShoppingBag,
  TrendingUp,
  MessageSquare,
} from "lucide-react"
import { ThemeSwitcher } from "@/components/theme-switcher"

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const superAdminNav: NavItem[] = [
  { title: "Dashboard", href: "/super-admin", icon: LayoutDashboard },
  { title: "Analytics", href: "/super-admin/analytics", icon: TrendingUp },
  { title: "Admins", href: "/super-admin/admins", icon: UserCog },
  { title: "Categories", href: "/super-admin/categories", icon: FolderTree },
  { title: "Vendors", href: "/super-admin/vendors", icon: Store },
  { title: "All Products", href: "/super-admin/products", icon: Package },
  { title: "Referrals", href: "/super-admin/referrals", icon: Gift },
  { title: "Ads", href: "/super-admin/ads", icon: Megaphone },
  { title: "Settings", href: "/super-admin/settings", icon: Settings },
]

const adminNav: NavItem[] = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "My Vendors", href: "/admin/vendors", icon: Store },
  { title: "Products", href: "/admin/products", icon: Package },
  { title: "Settings", href: "/admin/settings", icon: Settings },
]

const vendorNav: NavItem[] = [
  { title: "Dashboard", href: "/vendor", icon: LayoutDashboard },
  { title: "Analytics", href: "/vendor/analytics", icon: TrendingUp },
  { title: "Products", href: "/vendor/products", icon: Package },
  { title: "Messages", href: "/vendor/messages", icon: MessageSquare },
  { title: "Orders", href: "/vendor/orders", icon: ShoppingBag },
  { title: "Store Settings", href: "/vendor/store", icon: Store },
  { title: "Settings", href: "/vendor/settings", icon: Settings },
]

interface DashboardLayoutProps {
  children: React.ReactNode
  navItems?: NavItem[]
  userRole?: "super_admin" | "admin" | "vendor"
}

export function DashboardLayout({ children, navItems, userRole }: DashboardLayoutProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navigationItems =
    navItems || (userRole === "vendor" ? vendorNav : userRole === "admin" ? adminNav : superAdminNav)

  const NavContent = () => (
    <>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold">Navigation</h2>
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn("w-full justify-start", isActive && "bg-muted")}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.title}
                  </Button>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
      <div className="mt-auto border-t p-4 space-y-3">
        <ThemeSwitcher />
        <div className="mb-2 px-2 text-sm">
          <p className="font-medium">{user?.email}</p>
          <p className="text-xs text-muted-foreground capitalize">{user?.role?.replace("_", " ")}</p>
        </div>
        <Button variant="outline" className="w-full justify-start bg-transparent" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-muted/40 lg:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Store className="h-6 w-6" />
            <span>E-Commerce</span>
          </Link>
        </div>
        <ScrollArea className="flex-1">
          <NavContent />
        </ScrollArea>
      </aside>

      {/* Mobile Header & Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:hidden">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-14 items-center border-b px-4">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                  <Store className="h-6 w-6" />
                  <span>E-Commerce</span>
                </Link>
              </div>
              <ScrollArea className="h-[calc(100vh-3.5rem)]">
                <NavContent />
              </ScrollArea>
            </SheetContent>
          </Sheet>
          <h1 className="text-lg font-semibold">Dashboard</h1>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
