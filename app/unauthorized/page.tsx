import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon } from "@hugeicons/core-free-icons"

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <HugeiconsIcon icon={AlertCircleIcon} className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
          <CardDescription>You don&apos;t have permission to access this page.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/">
            <Button className="w-full">Go to Home</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
