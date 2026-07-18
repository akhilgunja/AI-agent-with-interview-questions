export type AuthResponse = {
  user: {
    id: number
    username: string
  }
  token: string
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (!response.ok) {
    throw new Error('Unable to sign in')
  }

  return response.json() as Promise<AuthResponse>
}

export async function register(username: string, password: string): Promise<AuthResponse> {
  const response = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (!response.ok) {
    throw new Error('Unable to create account')
  }

  return response.json() as Promise<AuthResponse>
}
