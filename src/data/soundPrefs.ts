import { ENCOURAGEMENTS, type RuntimePhrase } from './encouragements'

const PREFS_KEY = 'gym-timer-sound-prefs'

export type SoundPrefs = {
  deletedBuiltInIds: number[]
  disabledKeys: string[]
}

export function builtInKey(id: number): string {
  return `builtin:${id}`
}

export function savedKey(id: number): string {
  return `saved:${id}`
}

function defaultPrefs(): SoundPrefs {
  return { deletedBuiltInIds: [], disabledKeys: [] }
}

export function loadSoundPrefs(): SoundPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return defaultPrefs()
    const parsed = JSON.parse(raw) as Partial<SoundPrefs>
    return {
      deletedBuiltInIds: Array.isArray(parsed.deletedBuiltInIds)
        ? parsed.deletedBuiltInIds.filter((id) => Number.isInteger(id))
        : [],
      disabledKeys: Array.isArray(parsed.disabledKeys)
        ? parsed.disabledKeys.filter((key) => typeof key === 'string')
        : [],
    }
  } catch {
    return defaultPrefs()
  }
}

export function saveSoundPrefs(prefs: SoundPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Ignore storage errors.
  }
}

export function isSoundEnabled(key: string, prefs: SoundPrefs = loadSoundPrefs()): boolean {
  return !prefs.disabledKeys.includes(key)
}

export function setSoundEnabled(key: string, enabled: boolean): SoundPrefs {
  const prefs = loadSoundPrefs()
  const disabledKeys = prefs.disabledKeys.filter((item) => item !== key)
  if (!enabled) disabledKeys.push(key)
  const next = { ...prefs, disabledKeys }
  saveSoundPrefs(next)
  return next
}

export function deleteBuiltInSound(id: number): SoundPrefs {
  const prefs = loadSoundPrefs()
  const deletedBuiltInIds = prefs.deletedBuiltInIds.includes(id)
    ? prefs.deletedBuiltInIds
    : [...prefs.deletedBuiltInIds, id]
  const next = {
    deletedBuiltInIds,
    disabledKeys: prefs.disabledKeys.filter((key) => key !== builtInKey(id)),
  }
  saveSoundPrefs(next)
  return next
}

export type ManagedBuiltInSound = RuntimePhrase & {
  id: number
  key: string
}

export function getVisibleBuiltInSounds(
  prefs: SoundPrefs = loadSoundPrefs(),
): ManagedBuiltInSound[] {
  return ENCOURAGEMENTS.map((phrase, id) => ({
    id,
    key: builtInKey(id),
    phrase,
    audioUrl: `/audio/roasts/${String(id + 1).padStart(2, '0')}.mp3`,
  })).filter((item) => !prefs.deletedBuiltInIds.includes(item.id))
}

export function getActiveSounds(
  saved: Array<{ id: number; phrase: string; audioUrl: string }>,
  prefs: SoundPrefs = loadSoundPrefs(),
): RuntimePhrase[] {
  const builtIns = getVisibleBuiltInSounds(prefs)
  const candidates: Array<RuntimePhrase & { key: string }> = [
    ...builtIns.map((item) => ({
      key: item.key,
      phrase: item.phrase,
      audioUrl: item.audioUrl,
    })),
    ...saved.map((item) => ({
      key: savedKey(item.id),
      phrase: item.phrase,
      audioUrl: item.audioUrl,
    })),
  ]

  const enabled = candidates.filter((item) => isSoundEnabled(item.key, prefs))
  const active = enabled.length > 0 ? enabled : candidates

  return active.map(({ phrase, audioUrl }) => ({ phrase, audioUrl }))
}

export function countEnabledSounds(
  savedIds: number[],
  prefs: SoundPrefs = loadSoundPrefs(),
): number {
  const builtInEnabled = getVisibleBuiltInSounds(prefs).filter((item) =>
    isSoundEnabled(item.key, prefs),
  ).length
  const savedEnabled = savedIds.filter((id) =>
    isSoundEnabled(savedKey(id), prefs),
  ).length
  return builtInEnabled + savedEnabled
}
