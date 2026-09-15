import { NextRequest, NextResponse } from "next/server"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  const cookieToken = request.cookies.get("accessToken")?.value
  const authHeader = request.headers.get("authorization")
  const token = cookieToken || authHeader?.replace("Bearer ", "") || ""

  try {
    // Resolve the real video URL (S3 signed URL or backend path)
    const urlRes = await fetch(
      `${API_URL}/api/recording-url/${sessionId}?token=${token}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    )

    if (!urlRes.ok) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 })
    }

    const { url } = await urlRes.json() as { url?: string }
    if (!url) {
      return NextResponse.json({ error: "No URL returned" }, { status: 404 })
    }

    const videoUrl = url.startsWith("/")
      ? `${API_URL}${url}?token=${token}`
      : url

    // Forward Range header so the browser can seek
    const rangeHeader = request.headers.get("range")
    const upstream = await fetch(videoUrl, {
      headers: rangeHeader ? { Range: rangeHeader } : {},
    })

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ error: "Failed to fetch video" }, { status: upstream.status })
    }

    const responseHeaders: Record<string, string> = {
      "Content-Type": upstream.headers.get("content-type") || "video/webm",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    }

    const contentLength = upstream.headers.get("content-length")
    if (contentLength) responseHeaders["Content-Length"] = contentLength

    const contentRange = upstream.headers.get("content-range")
    if (contentRange) responseHeaders["Content-Range"] = contentRange

    // Stream — never buffer the whole file
    return new NextResponse(upstream.body, {
      status: upstream.status, // 200 or 206 Partial Content
      headers: responseHeaders,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
