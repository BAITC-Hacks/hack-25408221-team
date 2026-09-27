import { useCallback, useState } from "react"

export function useMediaPermissions() {
  const [micDenied, setMicDenied] = useState(false)
  const [noCamera, setNoCamera] = useState(false)
  // Distinct from noCamera: the device exists but the user explicitly
  // denied the permission prompt for it. Same audio-only fallback, but the
  // fix ("check your OS/browser permission settings") is different from a
  // missing/unreadable device, so the UI calls it out separately.
  const [cameraDenied, setCameraDenied] = useState(false)
  const [checkingMedia, setCheckingMedia] = useState(false)
  const [audioOnly, setAudioOnly] = useState(false)

  const checkMediaPermissions = useCallback(async () => {
    setCheckingMedia(true)
    setMicDenied(false)
    setNoCamera(false)
    setCameraDenied(false)

    let hasAudio = false
    let hasVideo = false

    try {
      // Fast path: attempt both audio and video together in a single request
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      hasAudio = true
      hasVideo = true
      stream.getTracks().forEach((t) => t.stop())
    } catch {
      // Fallback path: probe audio and video independently to isolate errors
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        hasAudio = true
        audioStream.getTracks().forEach((t) => t.stop())
      } catch (err: unknown) {
        const name = err instanceof Error ? err.name : ""
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setMicDenied(true)
        }
      }

      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
        hasVideo = true
        videoStream.getTracks().forEach((t) => t.stop())
      } catch (err: unknown) {
        const name = err instanceof Error ? err.name : ""
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setCameraDenied(true)
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "NotReadableError") {
          setNoCamera(true)
        }
      }
    }

    setCheckingMedia(false)
    return { hasAudio, hasVideo }
  }, [])

  return {
    micDenied,
    setMicDenied,
    noCamera,
    setNoCamera,
    cameraDenied,
    setCameraDenied,
    checkingMedia,
    audioOnly,
    setAudioOnly,
    checkMediaPermissions,
  }
}
