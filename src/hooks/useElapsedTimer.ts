import { useEffect, useState } from 'react'

export function useElapsedTimer(running: boolean) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!running) return

    const id = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1)
    }, 1000)

    return () => window.clearInterval(id)
  }, [running])

  return elapsedSeconds
}
