import { useEffect } from 'react'

/**
 * Keeps the screen awake while `enabled` is true (iPhone Safari 16.4+).
 * Background beeps after lock are not reliable on iOS web; wake lock is the practical fix.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return

    let lock: WakeLockSentinel | null = null
    let cancelled = false

    async function requestLock() {
      if (cancelled || document.visibilityState !== 'visible') return
      try {
        lock = await navigator.wakeLock.request('screen')
        lock.addEventListener('release', () => {
          lock = null
        })
      } catch {
        // Permission denied, unsupported context, or battery saver — ignore.
      }
    }

    void requestLock()

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void requestLock()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (lock) {
        void lock.release().catch(() => {})
        lock = null
      }
    }
  }, [enabled])
}
