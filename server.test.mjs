import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import { createAppServer } from './server.mjs'

test('GET /api/questions returns questions and POST /api/answers persists answers', async () => {
  const dbPath = path.join(process.cwd(), 'data', 'app.sqlite')
  if (fs.existsSync(dbPath)) {
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
      body: JSON.stringify({ username: 'tester', password: 'secret123' }),
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
