import { useEffect, useState } from 'react'

export function useElapsedTimer(running: boolean, initialSeconds = 0) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    Math.max(0, initialSeconds),
  )

  useEffect(() => {
    if (!running) return

    const id = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1)
    }, 1000)

    return () => window.clearInterval(id)
  }, [running])

  return elapsedSeconds
}
