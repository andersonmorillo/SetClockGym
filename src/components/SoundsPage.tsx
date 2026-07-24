import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  deletePhrase,
  fetchPhrases,
  savePhrase,
  type PhraseClip,
} from '../api/phrases'
import {
  builtInKey,
  countEnabledSounds,
  deleteBuiltInSound,
  getVisibleBuiltInSounds,
  isSoundEnabled,
  loadSoundPrefs,
  savedKey,
  saveSoundPrefs,
  setSoundEnabled,
  type SoundPrefs,
} from '../data/soundPrefs'

type Props = {
  onBack: () => void
}

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg',
  ]
  return candidates.find((type) => MediaRecorder.isTypeSupported(type))
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'webm'
}

export function SoundsPage({ onBack }: Props) {
  const [phrases, setPhrases] = useState<PhraseClip[]>([])
  const [prefs, setPrefs] = useState<SoundPrefs>(() => loadSoundPrefs())
  const [phrase, setPhrase] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState<string | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingPreviewUrlRef = useRef<string | null>(null)

  function clearRecordingPreview() {
    if (recordingPreviewUrlRef.current) {
      URL.revokeObjectURL(recordingPreviewUrlRef.current)
      recordingPreviewUrlRef.current = null
    }
    setRecordingPreviewUrl(null)
  }

  function stopMediaTracks() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
  }

  async function loadPhrases() {
    setLoading(true)
    setError(null)
    try {
      setPhrases(await fetchPhrases())
    } catch {
      setError('Could not load phrases. Is the API running?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPhrases()
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      stopMediaTracks()
      if (recordingPreviewUrlRef.current) {
        URL.revokeObjectURL(recordingPreviewUrlRef.current)
        recordingPreviewUrlRef.current = null
      }
    }
  }, [])

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    const text = phrase.trim()
    if (!text) {
      setError('Enter a phrase.')
      setMessage(null)
      return
    }
    if (!audioFile) {
      setError('Record or choose an audio file.')
      setMessage(null)
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const saved = await savePhrase(text, audioFile)
      setPhrases((current) => [saved, ...current])
      setPhrase('')
      setAudioFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      clearRecordingPreview()
      setMessage('Phrase saved and enabled for encouragements.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save phrase. Check the API and file type.',
      )
    } finally {
      setSaving(false)
    }
  }

  function playAudio(audioUrl: string) {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    const audio = new Audio(audioUrl)
    audioRef.current = audio
    void audio.play().catch(() => {
      setError('Could not play this audio file.')
    })
  }

  async function startRecording() {
    setError(null)
    setMessage(null)

    if (typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported in this browser.')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone access is not available in this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      recordedChunksRef.current = []

      const mimeType = pickRecorderMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(recordedChunksRef.current, { type })
        recordedChunksRef.current = []
        stopMediaTracks()
        mediaRecorderRef.current = null
        setRecording(false)

        if (blob.size === 0) {
          setError('Recording was empty. Try again.')
          return
        }

        const file = new File(
          [blob],
          `recording.${extensionForMime(type)}`,
          { type },
        )
        clearRecordingPreview()
        const previewUrl = URL.createObjectURL(blob)
        recordingPreviewUrlRef.current = previewUrl
        setRecordingPreviewUrl(previewUrl)
        setAudioFile(file)
        if (fileInputRef.current) fileInputRef.current.value = ''
        setMessage('Recording ready. Save the phrase to keep it.')
      }

      // Timeslice helps some browsers flush chunks before stop.
      recorder.start(250)
      setRecording(true)
      setMessage('Recording…')
    } catch {
      stopMediaTracks()
      setRecording(false)
      setError('Could not access the microphone. Check browser permissions.')
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'recording') return
    try {
      if (recorder.state === 'recording') recorder.requestData()
    } catch {
      // Older browsers may not support requestData.
    }
    recorder.stop()
  }

  function handleFileChange(file: File | null) {
    clearRecordingPreview()
    setAudioFile(file)
    setError(null)
    setMessage(file ? 'Audio file selected.' : null)
  }

  function handleToggle(key: string, enabled: boolean) {
    setError(null)
    setMessage(null)

    if (!enabled) {
      const enabledCount = countEnabledSounds(
        phrases.map((item) => item.id),
        prefs,
      )
      if (enabledCount <= 1 && isSoundEnabled(key, prefs)) {
        setError('Keep at least one sound enabled.')
        return
      }
    }

    setPrefs(setSoundEnabled(key, enabled))
    setMessage(enabled ? 'Sound enabled.' : 'Sound disabled.')
  }

  function handleDeleteBuiltIn(id: number) {
    setError(null)
    setMessage(null)
    const key = builtInKey(id)
    const wasEnabled = isSoundEnabled(key, prefs)
    const enabledCount = countEnabledSounds(
      phrases.map((item) => item.id),
      prefs,
    )
    const remainingVisible = getVisibleBuiltInSounds(prefs).length - 1 + phrases.length
    if (remainingVisible <= 0) {
      setError('Keep at least one sound available.')
      return
    }
    if (wasEnabled && enabledCount <= 1) {
      setError('Enable another sound before deleting the last enabled one.')
      return
    }
    setPrefs(deleteBuiltInSound(id))
    setMessage('Built-in sound removed from your list.')
  }

  async function handleDeleteSaved(id: number) {
    setError(null)
    setMessage(null)
    const key = savedKey(id)
    const wasEnabled = isSoundEnabled(key, prefs)
    const enabledCount = countEnabledSounds(
      phrases.map((item) => item.id),
      prefs,
    )
    const remainingVisible = getVisibleBuiltInSounds(prefs).length + phrases.length - 1
    if (remainingVisible <= 0) {
      setError('Keep at least one sound available.')
      return
    }
    if (wasEnabled && enabledCount <= 1) {
      setError('Enable another sound before deleting the last enabled one.')
      return
    }
    try {
      await deletePhrase(id)
      setPhrases((current) => current.filter((item) => item.id !== id))
      const cleaned = {
        ...prefs,
        disabledKeys: prefs.disabledKeys.filter((item) => item !== key),
      }
      saveSoundPrefs(cleaned)
      setPrefs(cleaned)
      setMessage('Phrase deleted.')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not delete phrase.',
      )
    }
  }

  const builtInSounds = getVisibleBuiltInSounds(prefs)

  return (
    <div className="sounds-page screen-enter">
      <header className="header">
        <div className="progress-top">
          <button type="button" className="ghost" onClick={onBack}>
            Back
          </button>
          <span className="brand-mark">Sounds</span>
        </div>
        <h1>Phrase sounds</h1>
        <p>Choose which sounds play during workouts. Uncheck or delete the ones you don’t want.</p>
      </header>

      <section className="section-card">
        <h2>Add phrase</h2>
        <p className="section-kicker">
          Record your voice or upload mp3, wav, ogg, m4a, or webm. New clips are
          enabled by default.
        </p>
        <form className="sounds-form" onSubmit={(e) => void handleSave(e)}>
          <label>
            Phrase
            <input
              type="text"
              value={phrase}
              placeholder="One more round…"
              onChange={(e) => setPhrase(e.target.value)}
            />
          </label>
          <div className="record-controls">
            <span className="record-label">Voice recording</span>
            <div className="record-actions">
              {!recording ? (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => void startRecording()}
                  disabled={saving}
                >
                  Record
                </button>
              ) : (
                <button
                  type="button"
                  className="primary record-stop"
                  onClick={stopRecording}
                >
                  Stop
                </button>
              )}
              {recordingPreviewUrl && !recording && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => playAudio(recordingPreviewUrl)}
                >
                  Play recording
                </button>
              )}
            </div>
            {recording && <p className="record-status">Recording…</p>}
            {audioFile && !recording && (
              <p className="muted">
                Ready: {audioFile.name}
              </p>
            )}
          </div>
          <label>
            Or upload audio file
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
              onChange={(e) =>
                handleFileChange(e.target.files?.[0] ?? null)
              }
              disabled={recording || saving}
            />
          </label>
          <button type="submit" className="primary" disabled={saving || recording}>
            {saving ? 'Saving…' : 'Save phrase'}
          </button>
        </form>
        {message && <p className="muted">{message}</p>}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="section-card">
        <h2>Built-in sounds</h2>
        <p className="section-kicker">
          Check the clips you want to hear. Delete hides a clip from your list.
        </p>
        {builtInSounds.length === 0 ? (
          <p className="muted">All built-in sounds were removed from your list.</p>
        ) : (
          <ul className="sounds-list">
            {builtInSounds.map((item) => {
              const enabled = isSoundEnabled(item.key, prefs)
              return (
                <li key={item.key}>
                  <label className="sound-check">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => handleToggle(item.key, e.target.checked)}
                    />
                    <span>
                      <span className="muted">
                        {String(item.id + 1).padStart(2, '0')}.
                      </span>{' '}
                      “{item.phrase}”
                    </span>
                  </label>
                  <div className="item-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => playAudio(item.audioUrl)}
                    >
                      Play
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => handleDeleteBuiltIn(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="section-card">
        <h2>Saved phrases</h2>
        {loading && <p className="muted">Loading…</p>}
        {!loading && phrases.length === 0 && (
          <p className="muted">No saved phrases yet.</p>
        )}
        {phrases.length > 0 && (
          <ul className="sounds-list">
            {phrases.map((item) => {
              const key = savedKey(item.id)
              const enabled = isSoundEnabled(key, prefs)
              return (
                <li key={item.id}>
                  <label className="sound-check">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => handleToggle(key, e.target.checked)}
                    />
                    <span>“{item.phrase}”</span>
                  </label>
                  <div className="item-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => playAudio(item.audioUrl)}
                    >
                      Play
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => void handleDeleteSaved(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
