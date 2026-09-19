import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

/** Redirects to /signin if no valid userId is in localStorage; otherwise exposes it. */
export function useAuthGuard() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const uid = localStorage.getItem("userId")
    if (!uid || uid === "undefined" || uid === "null") {
      localStorage.removeItem("userId")
      localStorage.removeItem("userName")
      localStorage.removeItem("userEmail")
      router.replace("/signin")
      return
    }
    setUserId(uid)
    setAuthChecked(true)
  }, [router])

  return { userId, authChecked }
}
