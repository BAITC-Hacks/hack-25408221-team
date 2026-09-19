import { useCallback, useState } from "react"

export function useMediaPermissions() {
  const [micDenied, setMicDenied] = useState(false)
  const [noCamera, setNoCamera] = useState(false)
  const [checkingMedia, setCheckingMedia] = useState(false)
  const [audioOnly, setAudioOnly] = useState(false)

  const checkMediaPermissions = useCallback(async () => {
    setCheckingMedia(true)
    setMicDenied(false)
    setNoCamera(false)

    let hasAudio = false
    let hasVideo = false

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
      if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "NotReadableError") {
        setNoCamera(true)
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
    checkingMedia,
    audioOnly,
    setAudioOnly,
    checkMediaPermissions,
  }
}
