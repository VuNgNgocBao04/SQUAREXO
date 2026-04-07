const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
const AUTH_TOKEN_KEY = 'squarexo-access-token'
const REFRESH_TOKEN_KEY = 'squarexo-refresh-token'
const USER_KEY = 'squarexo-user'

const AUTH_API_BASE = `${BACKEND_URL}/api/auth`

export type User = {
  id: string
  username: string
  email: string
  role: string
  walletAddress?: string
  createdAt?: string
  updatedAt?: string
}

export type AuthResponse = {
  accessToken: string
  refreshToken: string
  user: User
}

export async function register(
  username: string,
  email: string,
  password: string,
  walletAddress?: string,
): Promise<AuthResponse> {
  const response = await fetch(`${AUTH_API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password, walletAddress }),
  })

  const data = await readJsonResponse<AuthResponse>(response, 'Register failed')
  saveTokens(data.accessToken, data.refreshToken)
  saveUser(data.user)
  return data
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${AUTH_API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  const data = await readJsonResponse<AuthResponse>(response, 'Login failed')
  saveTokens(data.accessToken, data.refreshToken)
  saveUser(data.user)
  return data
}

export function logout(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getAccessToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function getUser(): User | null {
  try {
    const user = localStorage.getItem(USER_KEY)
    return user ? (JSON.parse(user) as User) : null
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  return !!getAccessToken() && !!getUser()
}

function saveTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

function saveUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const contentType = response.headers.get('content-type') || ''
  const bodyText = await response.text()

  if (!response.ok) {
    if (contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(bodyText) as { error?: string; message?: string }
        throw new Error(parsed.error || parsed.message || fallbackMessage)
      } catch {
        throw new Error(fallbackMessage)
      }
    }

    throw new Error(bodyText || fallbackMessage)
  }

  if (!contentType.includes('application/json')) {
    throw new Error(`Unexpected response from backend: ${bodyText.slice(0, 120)}`)
  }

  return JSON.parse(bodyText) as T
}
