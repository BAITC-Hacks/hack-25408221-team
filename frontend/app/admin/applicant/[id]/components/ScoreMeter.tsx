"use client"

export function ScoreMeter({
  value,
  max = 100,
  label,
  color = "bg-[#CDFA1A]",
  className,
}: {
  value: number
  max?: number
  label?: string
  color?: string
  className?: string
}) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className={`space-y-1 ${className || ""}`}>
      {label && (
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">
            {value}/{max}
          </span>
        </div>
      )}
      <div className="h-2 rounded-full bg-muted">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function DimensionRow({
  label,
  score,
  max = 5,
}: {
  label: string
  score: number
  max?: number
}) {
  const pct = Math.min(100, (score / max) * 100)
  const color =
    pct >= 80
      ? "bg-green-500"
      : pct >= 60
        ? "bg-[#CDFA1A]"
        : pct >= 40
          ? "bg-yellow-500"
          : "bg-red-500"
  return (
    <div className="flex items-center gap-3">
      <span className="w-44 shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-sm font-medium">
        {score}/{max}
      </span>
    </div>
  )
}
