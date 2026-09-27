"use client"

import { Users, Video, Clock, CheckCircle2 } from "lucide-react"

export interface AdminStats {
  total: number
  withRecording: number
  withoutRecording: number
  recommended: number
}

export function StatsCards({ stats }: { stats: AdminStats }) {
  return (
    <div className="mb-8 grid gap-4 md:grid-cols-4">
      <div className="rounded-xl border border-border bg-background p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Applications</p>
            <p className="mt-1 text-3xl font-bold">{stats.total}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">With Recording</p>
            <p className="mt-1 text-3xl font-bold">{stats.withRecording}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <Video className="h-6 w-6 text-green-600" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Pending Recording</p>
            <p className="mt-1 text-3xl font-bold">{stats.withoutRecording}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
            <Clock className="h-6 w-6 text-yellow-600" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Recommended</p>
            <p className="mt-1 text-3xl font-bold">{stats.recommended}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#CDFA1A]/30">
            <CheckCircle2 className="h-6 w-6 text-[#6B8E23]" />
          </div>
        </div>
      </div>
    </div>
  )
}
