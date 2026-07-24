export const ENCOURAGEMENTS = [
  'Get fit because she rejected you.',
  'They said you couldn’t. Prove them wrong.',
  'Your future self is watching. Don’t disappoint them.',
  'Sweat now. Flex later.',
  'One more round. Excuses don’t build muscle.',
  'Heartbreak burns calories. Use it.',
  'Be the reason your clothes fit better.',
  'Nobody is coming to save you. Start the timer.',
  'Train like you have something to prove.',
  'Pain is temporary. Skipping today lasts longer.',
  'You vs you. Win today.',
  'Make them ask what you’ve been doing.',
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
