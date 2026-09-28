import { useState, useRef, useCallback } from "react"

export function useInterviewTimer() {
  const [timerSecs, setTimerSecs] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    setTimerSecs(0)
    let secs = 0
    timerRef.current = setInterval(() => {
      secs++
      setTimerSecs(secs)
    }, 1000)
  }, [stopTimer])

  return { timerSecs, setTimerSecs, startTimer, stopTimer }
}
