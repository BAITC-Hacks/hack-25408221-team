export interface TokenPayload {
  sub: string
  role?: string
  exp?: number
  iat?: number
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null

    let base64Url = parts[1]
    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const pad = base64.length % 4
    if (pad) {
      if (pad === 1) return null
      base64 += "===".substring(0, 4 - pad)
    }

    const payload = JSON.parse(atob(base64))
    return payload
  } catch {
    return null
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token)
  if (!payload || !payload.exp) return true
  const currentTime = Math.floor(Date.now() / 1000)
  return payload.exp < currentTime
}

export function isTokenValid(token: string | null): boolean {
  if (!token) return false
  return !isTokenExpired(token)
}

const TOKEN_KEY = "invision_access_token"

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token || !isTokenValid(token)) return null
  return token
}

export function setStoredToken(token: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(TOKEN_KEY, token)
  document.cookie = `accessToken=${token}; path=/; max-age=86400; SameSite=Lax`
}

export function clearStoredToken() {
  if (typeof window === "undefined") return
  localStorage.removeItem(TOKEN_KEY)
  document.cookie = "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0"
}
