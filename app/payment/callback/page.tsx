"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Spinner } from "@/components/ui/spinner"

export default function PaymentCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const reference = searchParams.get("reference")
    
    if (reference) {
      // Redirect to verify page with reference
      router.push(`/payment/verify?reference=${reference}`)
    } else {
      // No reference, redirect to register
      router.push("/register")
    }
  }, [searchParams, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="text-center">
        <Spinner className="mx-auto h-8 w-8" />
        <p className="mt-4 text-sm text-muted-foreground">Processing payment...</p>
      </div>
    </div>
  )
}

