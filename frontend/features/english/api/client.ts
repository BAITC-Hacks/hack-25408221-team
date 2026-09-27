export class EnglishApiError extends Error {
  status: number
  detail: unknown
  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail))
    this.status = status
    this.detail = detail
  }
}

export const ENGLISH_TOKEN_KEY = "eg_applicant_token"
export const ENGLISH_SESSION_KEY = "eg_session_id"
export const ENGLISH_ADMIN_TOKEN_KEY = "eg_admin_token"

export function getDefaultApiUrl(): string {
  const base = (
    process.env.NEXT_PUBLIC_ENGLISH_GATE_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ""
  ).replace(/\/$/, "")
  return `${base}/api/english`
}

export function getLocalToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ENGLISH_TOKEN_KEY)
}

export function setLocalToken(token: string) {
  if (typeof window === "undefined") return
  if (getLocalToken() !== token) localStorage.removeItem(ENGLISH_SESSION_KEY)
  localStorage.setItem(ENGLISH_TOKEN_KEY, token)
}

export function clearLocalToken() {
  if (typeof window === "undefined") return
  localStorage.removeItem(ENGLISH_TOKEN_KEY)
  localStorage.removeItem(ENGLISH_SESSION_KEY)
}

export function getLocalSessionId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ENGLISH_SESSION_KEY)
}

export function setLocalSessionId(id: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(ENGLISH_SESSION_KEY, id)
}

export function getLocalAdminToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ENGLISH_ADMIN_TOKEN_KEY)
}

export function setLocalAdminToken(token: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(ENGLISH_ADMIN_TOKEN_KEY, token)
}

export function clearLocalAdminToken() {
  if (typeof window === "undefined") return
  localStorage.removeItem(ENGLISH_ADMIN_TOKEN_KEY)
}

export async function englishRequest<T>(
  path: string,
  options: RequestInit & { asAdmin?: boolean; tokenOverride?: string } = {},
  baseUrl: string = getDefaultApiUrl()
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json"
  }

  const token =
    options.tokenOverride ||
    (options.asAdmin ? getLocalAdminToken() : getLocalToken())

  if (token) headers["Authorization"] = `Bearer ${token}`

  const timeoutMs = path.endsWith("/finish") ? 360000 : 30000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    })

    if (!res.ok) {
      let detail: unknown
      try {
        detail = await res.json()
      } catch {
        detail = await res.text()
      }
      throw new EnglishApiError(
        res.status,
        (detail as { detail?: unknown })?.detail ?? detail
      )
    }

    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  } finally {
    clearTimeout(timeoutId)
  }
}
