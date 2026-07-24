import { useEffect, useMemo, useState } from 'react'
import { fetchPhrases } from '../api/phrases'
import {
  ENCOURAGEMENTS,
  getEncouragementLines,
  pickEncouragementIndex,
  setRuntimePhrases,
} from '../data/encouragements'
import { getActiveSounds } from '../data/soundPrefs'
import { speakRoast, stopSpeaking } from '../utils/speech'

type Props = {
  seed: string | number
}

export function Encouragement({ seed }: Props) {
  const [ready, setReady] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchPhrases()
      .then((phrases) => {
        if (cancelled) return
        setRuntimePhrases(getActiveSounds(phrases))
        setVersion((value) => value + 1)
        setReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setRuntimePhrases(getActiveSounds([]))
        setVersion((value) => value + 1)
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const index = useMemo(() => {
    const numeric =
      typeof seed === 'number'
        ? seed
        : [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0)
    return pickEncouragementIndex(numeric)
  }, [seed, version])

  const line = ready
    ? (getEncouragementLines()[index] ?? ENCOURAGEMENTS[0])
    : ENCOURAGEMENTS[0]

  useEffect(() => {
    if (!ready) return
    speakRoast(index)
    return () => {
      stopSpeaking()
    }
  }, [index, ready, version])

  return <p className="encouragement">“{line}”</p>
}
