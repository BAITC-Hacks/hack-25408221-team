import Link from "next/link"
import { Settings as SettingsIcon } from "lucide-react"

export default function SettingsPage() {
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
          <h1 className="text-2xl font-bold mb-6">Settings</h1>
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-4 text-muted-foreground">
              <SettingsIcon className="h-8 w-8" />
              <p>Settings page is under construction.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}