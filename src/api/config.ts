function configuredBaseUrl(): string | null {
  const configured = import.meta.env.VITE_API_URL
  if (typeof configured !== 'string') return null
  const trimmed = configured.trim().replace(/\/$/, '')
  return trimmed || null
}

/** Same-origin (Vite proxy) unless VITE_API_URL is set. */
export function getApiBaseUrl(): string {
  return configuredBaseUrl() ?? ''
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl()
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)

  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host.endsWith('.ngrok-free.dev') || host.endsWith('.ngrok.app')) {
      headers.set('ngrok-skip-browser-warning', 'true')
    }
  }

  return fetch(apiUrl(path), {
    ...init,
    headers,
  })
}
