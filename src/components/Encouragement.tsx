import { useEffect, useMemo } from 'react'
import {
  ENCOURAGEMENTS,
  pickEncouragementIndex,
} from '../data/encouragements'
import { speakRoast, stopSpeaking } from '../utils/speech'

type Props = {
  seed: string | number
}

export function Encouragement({ seed }: Props) {
  const index = useMemo(() => {
    const numeric =
      typeof seed === 'number'
        ? seed
        : [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0)
    return pickEncouragementIndex(numeric)
  }, [seed])

  const line = ENCOURAGEMENTS[index]

  useEffect(() => {
    speakRoast(index)
    return () => {
      stopSpeaking()
    }
  }, [index])

  return <p className="encouragement">“{line}”</p>
}
