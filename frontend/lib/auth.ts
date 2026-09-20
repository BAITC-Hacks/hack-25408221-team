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

export function getTokenExpiryTime(token: string): Date | null {
  const payload = decodeToken(token)
  if (!payload?.exp) return null
  return new Date(payload.exp * 1000)
}

export function getTimeUntilExpiry(token: string): string {
  const expiry = getTokenExpiryTime(token)
  if (!expiry) return "Unknown"
  
  const now = new Date()
  const diff = expiry.getTime() - now.getTime()
  
  if (diff <= 0) return "Expired"
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  return `${minutes}m`
}
