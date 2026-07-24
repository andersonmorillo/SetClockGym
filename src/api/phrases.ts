import { apiFetch, apiUrl } from './config'

export type PhraseClip = {
  id: number
  phrase: string
  audioUrl: string
  createdAt: string
}

type PhraseApiRow = {
  id: number
  phrase: string
  audio_url: string
  created_at: string
}

function mapPhrase(row: PhraseApiRow): PhraseClip {
  return {
    id: row.id,
    phrase: row.phrase,
    audioUrl: apiUrl(row.audio_url),
    createdAt: row.created_at,
  }
}

export async function fetchPhrases(): Promise<PhraseClip[]> {
  const response = await apiFetch('/api/phrases')
  if (!response.ok) {
    throw new Error('Could not load phrases')
  }
  const rows = (await response.json()) as PhraseApiRow[]
  return rows.map(mapPhrase)
}

export async function savePhrase(
  phrase: string,
  audio: File,
): Promise<PhraseClip> {
  const body = new FormData()
  body.append('phrase', phrase)
  body.append('audio', audio)

  const response = await apiFetch('/api/phrases', {
    method: 'POST',
    body,
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Could not save phrase')
  }
  return mapPhrase((await response.json()) as PhraseApiRow)
}

export async function deletePhrase(id: number): Promise<void> {
  const response = await apiFetch(`/api/phrases/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Could not delete phrase')
  }
}
