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
      if (pad === 1) {
        throw new Error("Invalid base64url string")
      }
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

export function isTokenValid(token: string): boolean {
  if (!token) return false
  if (isTokenExpired(token)) return false
  return true
}
