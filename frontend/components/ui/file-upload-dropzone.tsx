"use client"

import { useState, useRef, ChangeEvent, DragEvent } from "react"
import { Upload, FileText, CheckCircle2, X } from "lucide-react"

interface FileUploadDropzoneProps {
  label?: string
  required?: boolean
  accept?: string
  maxSizeMB?: number
  onFileSelect?: (file: File | null) => void
  error?: string
}

export function FileUploadDropzone({
  label,
  required,
  accept = ".pdf,.jpg,.jpeg,.png,.heic",
  maxSizeMB = 10,
  onFileSelect,
  error,
}: FileUploadDropzoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    if (file.size > maxSizeMB * 1024 * 1024) {
      setLocalError(`File size must be under ${maxSizeMB} MB`)
      return
    }
    setLocalError(null)
    setSelectedFile(file)
    onFileSelect?.(file)
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function removeFile() {
    setSelectedFile(null)
    setLocalError(null)
    if (inputRef.current) inputRef.current.value = ""
    onFileSelect?.(null)
  }

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onChange}
        className="sr-only"
        id={`file-input-${label?.replace(/\s+/g, "-") || "default"}`}
      />

      {selectedFile ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#CDFA1A]/20 text-[#6B8E23]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Selected
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={removeFile}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-6 transition-colors ${
            isDragging
              ? "border-[#CDFA1A] bg-[#CDFA1A]/10"
              : "border-border hover:border-[#CDFA1A]/60 bg-muted/10"
          }`}
        >
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background">
            <Upload className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm">
            <span className="font-semibold text-[#6B8E23] hover:underline">Click to upload</span>{" "}
            or drag and drop
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Formats allowed: PDF, JPG, PNG, HEIC (max {maxSizeMB} MB)
          </p>
        </div>
      )}

      {(localError || error) && (
        <p className="text-xs text-red-500">{localError || error}</p>
      )}
    </div>
  )
}
