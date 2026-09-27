"use client"

import { useRouter } from "next/navigation"
import { IeltsForm } from "../components/IeltsForm"
import { IeltsCheckOut } from "../types"

export function IeltsVerificationFlow({
  token,
  onVerified,
  testRedirectUrl = "/english/test",
}: {
  token?: string
  onVerified?: (result: IeltsCheckOut) => void
  testRedirectUrl?: string
}) {
  const router = useRouter()

  return (
    <div className="max-w-3xl mx-auto">
      <IeltsForm
        token={token}
        onVerified={onVerified}
        onProceedToTest={() => router.push(testRedirectUrl)}
      />
    </div>
  )
}
