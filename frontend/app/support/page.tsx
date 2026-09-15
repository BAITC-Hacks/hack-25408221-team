import Link from "next/link"
import { MessageCircle } from "lucide-react"

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background px-8 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-bold">
            inVision U
          </Link>
        </div>
      </header>
      
      <main className="p-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-bold mb-6">Support</h1>
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-4 text-muted-foreground">
              <MessageCircle className="h-8 w-8" />
              <p>Support page is under construction.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}