import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { api } from "@/lib/api"

export function useRecordingUpload(
  sessionId: string | null,
  hasRecording: boolean,
  recordedBlobRef: RefObject<Blob | null>,
) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [uploaded, setUploaded] = useState(false)
  // Guards the automatic first attempt only -- without it, uploading
  // flipping back to false after a failure re-satisfies the effect's own
  // condition and it would immediately re-fire itself forever. Manual
  // retries call attemptUpload() directly and bypass this guard.
  const autoAttemptedRef = useRef(false)

  const attemptUpload = useCallback(() => {
    if (!sessionId || !recordedBlobRef.current) return
    setUploading(true)
    setUploadError("")
    api.uploadRecording(sessionId, recordedBlobRef.current)
      .then(() => setUploaded(true))
      .catch(() => setUploadError("Recording upload failed. Your interview was completed but the video could not be saved."))
      .finally(() => setUploading(false))
  }, [sessionId, recordedBlobRef])

  useEffect(() => {
    if (!hasRecording || !recordedBlobRef.current || !sessionId || autoAttemptedRef.current) return
    autoAttemptedRef.current = true
    attemptUpload()
  }, [hasRecording, sessionId, recordedBlobRef, attemptUpload])

  useEffect(() => {
    if (!uploading && !uploadError) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [uploading, uploadError])

  return { uploading, uploadError, uploaded, retryUpload: attemptUpload }
}
