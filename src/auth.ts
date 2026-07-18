export type AuthResponse = {
  user: {
    id: number
    username: string
    email?: string
    emailVerified?: boolean
  }
  token: string
  requiresVerification?: boolean
  verificationCode?: string
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string }
    return data.error || 'Authentication failed'
  } catch {
    return 'Authentication failed'
  }
}

export async function login(username: string, password: string, email?: string): Promise<AuthResponse> {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return response.json() as Promise<AuthResponse>
}

export async function register(username: string, email: string, password: string): Promise<AuthResponse> {
  const response = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return response.json() as Promise<AuthResponse>
}
export async function verifyEmail(email: string, code: string): Promise<AuthResponse> {
  const response = await fetch('/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return response.json() as Promise<AuthResponse>
}
