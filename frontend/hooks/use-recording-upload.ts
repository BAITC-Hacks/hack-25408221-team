import { useEffect, useState, type RefObject } from "react"
import { api } from "@/lib/api"

export function useRecordingUpload(
  sessionId: string | null,
  hasRecording: boolean,
  recordedBlobRef: RefObject<Blob | null>,
) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [uploaded, setUploaded] = useState(false)

  useEffect(() => {
    if (!hasRecording || !recordedBlobRef.current || !sessionId || uploaded || uploading) return
    setUploading(true)
    setUploadError("")
    api.uploadRecording(sessionId, recordedBlobRef.current)
      .then(() => setUploaded(true))
      .catch(() => setUploadError("Recording upload failed. Your interview was completed but the video could not be saved."))
      .finally(() => setUploading(false))
  }, [hasRecording, sessionId, uploaded, uploading, recordedBlobRef])

  return { uploading, uploadError, uploaded }
}
