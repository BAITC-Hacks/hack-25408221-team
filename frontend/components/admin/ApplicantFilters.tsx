"use client"

import { Search, Filter, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ApplicantFilters({
  searchQuery,
  setSearchQuery,
  filterProgram,
  setFilterProgram,
  filterRecording,
  setFilterRecording,
  programs,
}: {
  searchQuery: string
  setSearchQuery: (query: string) => void
  filterProgram: string
  setFilterProgram: (program: string) => void
  filterRecording: string
  setFilterRecording: (rec: string) => void
  programs: string[]
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name, email, or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:border-foreground"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="min-w-[140px]">
            <Filter className="mr-2 h-4 w-4" />
            {filterProgram === "all" ? "All Programs" : filterProgram}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setFilterProgram("all")}>
            All Programs
          </DropdownMenuItem>
          {programs.map((p) => (
            <DropdownMenuItem key={p} onClick={() => setFilterProgram(p)}>
              {p}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="min-w-[160px]">
            <Filter className="mr-2 h-4 w-4" />
            {filterRecording === "all"
              ? "All Recordings"
              : filterRecording === "true"
                ? "Has Recording"
                : "No Recording"}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setFilterRecording("all")}>
            All Recordings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFilterRecording("true")}>
            Has Recording
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFilterRecording("false")}>
            No Recording
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
