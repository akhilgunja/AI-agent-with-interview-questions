import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import { spawn } from 'node:child_process'

process.env.DB_PATH = path.join(process.cwd(), 'data', `server-test-${process.pid}-${Date.now()}.sqlite`)
const { createAppServer } = await import('./server.mjs')

test('node server.mjs starts the API server and serves /api/health', async () => {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '3101' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  try {
    let lastError
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const response = await fetch('http://127.0.0.1:3101/api/health')
        if (response.ok) {
          const payload = await response.json()
          assert.equal(payload.status, 'ok')
          return
        }
      } catch (error) {
        lastError = error
      }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw lastError || new Error(`Server did not start. Stdout: ${stdout}\nStderr: ${stderr}`)
  } finally {
    child.kill('SIGTERM')
  }
})

test('GET /api/questions returns questions and POST /api/answers persists answers', async () => {
  const dbPath = process.env.DB_PATH
  if (dbPath && fs.existsSync(dbPath)) {
    try {
      fs.rmSync(dbPath)
    } catch {
      // Ignore cleanup errors so the test can still run in a busy workspace.
    }
  }

  const server = createAppServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  try {
    const questionsResponse = await fetch(`http://127.0.0.1:${port}/api/questions`)
    assert.equal(questionsResponse.status, 200)
    const questions = await questionsResponse.json()
    assert.ok(Array.isArray(questions))
    assert.ok(questions.length > 0)

    const registerResponse = await fetch(`http://127.0.0.1:${port}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'tester', email: 'tester@example.com', password: 'secret123' }),
    })
    assert.equal(registerResponse.status, 200)
    const auth = await registerResponse.json()
    const token = auth.token

    const answerResponse = await fetch(`http://127.0.0.1:${port}/api/answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ questionId: 1, answer: 'I would explain it clearly.' }),
    })
    assert.equal(answerResponse.status, 200)
    const savedAnswer = await answerResponse.json()
    assert.equal(savedAnswer.answer, 'I would explain it clearly.')

    const savedAnswersResponse = await fetch(`http://127.0.0.1:${port}/api/answers`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(savedAnswersResponse.status, 200)
    const savedAnswers = await savedAnswersResponse.json()
    assert.equal(savedAnswers.length, 1)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
})

test('POST /api/register rejects duplicate usernames with a conflict response', async () => {
  const dbPath = process.env.DB_PATH
  if (dbPath && fs.existsSync(dbPath)) {
    try {
      fs.rmSync(dbPath)
    } catch {
      // Ignore cleanup errors so the test can still run in a busy workspace.
    }
  }

  const server = createAppServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  try {
    const first = await fetch(`http://127.0.0.1:${port}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'duplicate', email: 'duplicate@example.com', password: 'secret123' }),
    })
    assert.equal(first.status, 200)

    const second = await fetch(`http://127.0.0.1:${port}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'duplicate', email: 'duplicate@example.com', password: 'secret123' }),
    })
    assert.equal(second.status, 409)
    const body = await second.json()
    assert.match(body.error, /already exists/i)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
})

test('POST /api/verify completes email verification for a new account', async () => {
  const dbPath = process.env.DB_PATH
  if (dbPath && fs.existsSync(dbPath)) {
    try {
      fs.rmSync(dbPath)
    } catch {
      // Ignore cleanup errors so the test can still run in a busy workspace.
    }
  }

  const server = createAppServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  try {
    const registerResponse = await fetch(`http://127.0.0.1:${port}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'verified', email: 'verified@example.com', password: 'secret123' }),
    })
    assert.equal(registerResponse.status, 200)
    const payload = await registerResponse.json()
    assert.equal(payload.requiresVerification, true)

    const verifyResponse = await fetch(`http://127.0.0.1:${port}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'verified@example.com', code: payload.verificationCode }),
    })
    assert.equal(verifyResponse.status, 200)
    const verified = await verifyResponse.json()
    assert.equal(verified.user.emailVerified, true)
    assert.ok(verified.token)

    const loginResponse = await fetch(`http://127.0.0.1:${port}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'verified', password: 'secret123' }),
    })
    assert.equal(loginResponse.status, 200)
    const signedIn = await loginResponse.json()
    assert.equal(signedIn.user.username, 'verified')
    assert.ok(signedIn.token)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
})
