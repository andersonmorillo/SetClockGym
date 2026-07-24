export const ENCOURAGEMENTS = [
  'Get fit because she rejected you.',
] as const

export type RuntimePhrase = {
  phrase: string
  audioUrl: string
}

let runtimePhrases: RuntimePhrase[] | null = null

export function setRuntimePhrases(phrases: RuntimePhrase[] | null): void {
  runtimePhrases =
    phrases && phrases.length > 0
      ? phrases.map((item) => ({
          phrase: item.phrase,
          audioUrl: item.audioUrl,
        }))
      : null
}

export function getEncouragementLines(): string[] {
  if (runtimePhrases) {
    return runtimePhrases.map((item) => item.phrase)
  }
  return [...ENCOURAGEMENTS]
}

export function pickEncouragementIndex(seed = Date.now()): number {
  const length = Math.max(1, getEncouragementLines().length)
  return Math.abs(seed) % length
}

export function pickEncouragement(seed = Date.now()): string {
  const lines = getEncouragementLines()
  return lines[pickEncouragementIndex(seed)] ?? lines[0] ?? ''
}

export function getRoastAudioPath(index: number): string {
  const lines = getEncouragementLines()
  const length = Math.max(1, lines.length)
  const safeIndex = ((index % length) + length) % length

  if (runtimePhrases) {
    return runtimePhrases[safeIndex]?.audioUrl ?? ''
  }

  const file = String(safeIndex + 1).padStart(2, '0')
  return `/audio/roasts/${file}.mp3`
}

export function getBuiltInSounds(): RuntimePhrase[] {
  return ENCOURAGEMENTS.map((phrase, index) => ({
    phrase,
    audioUrl: `/audio/roasts/${String(index + 1).padStart(2, '0')}.mp3`,
  }))
}
