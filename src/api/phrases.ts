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

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const data: unknown = await response.json()
    if (data && typeof data === 'object' && 'detail' in data) {
      const detail = (data as { detail: unknown }).detail
      if (typeof detail === 'string' && detail.trim()) return detail
    }
  } catch {
    // ignore parse errors
  }
  return `${fallback} (HTTP ${response.status})`
}

export async function fetchPhrases(): Promise<PhraseClip[]> {
  const response = await apiFetch('/api/phrases')
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Could not load phrases'))
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
    throw new Error(await readApiError(response, 'Could not save phrase'))
  }
  return mapPhrase((await response.json()) as PhraseApiRow)
}

export async function deletePhrase(id: number): Promise<void> {
  const response = await apiFetch(`/api/phrases/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Could not delete phrase'))
  }
}
