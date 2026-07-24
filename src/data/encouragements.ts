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

export function pickEncouragementIndex(seed = Date.now()): number {
  return Math.abs(seed) % ENCOURAGEMENTS.length
}

export function pickEncouragement(seed = Date.now()): string {
  return ENCOURAGEMENTS[pickEncouragementIndex(seed)]
}

export function getRoastAudioPath(index: number): string {
  const safeIndex =
    ((index % ENCOURAGEMENTS.length) + ENCOURAGEMENTS.length) %
    ENCOURAGEMENTS.length
  const file = String(safeIndex + 1).padStart(2, '0')
  return `/audio/roasts/${file}.mp3`
}
