import path from 'node:path'
import fs from 'node:fs'
import http from 'node:http'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sendVerificationEmail } from './mail.mjs'

const companyList = [
  'Google', 'Microsoft', 'Amazon', 'Meta', 'Netflix', 'Adobe', 'Salesforce', 'Uber', 'Spotify', 'Stripe',
  'Dropbox', 'Slack', 'Airbnb', 'Twilio', 'Shopify', 'GitHub', 'Databricks', 'Snowflake', 'MongoDB', 'NVIDIA',
  'Oracle', 'Intuit', 'Palantir', 'Atlassian', 'LinkedIn', 'IBM', 'Cisco', 'Intel', 'PayPal', 'Tesla',
  'JPMorgan', 'Goldman Sachs', 'Infosys', 'TCS', 'Accenture', 'Deloitte', 'PwC', 'Capital One', 'DoorDash', 'Coinbase',
]
const categoryList = ['React', 'System Design', 'API Design', 'Security', 'Performance', 'Architecture', 'TypeScript', 'Data', 'DevOps', 'Reliability']
const topicList = [
  'a scalable frontend architecture',
  'a resilient API layer',
  'a low-latency data pipeline',
  'a secure authentication experience',
  'a high-throughput observability system',
  'an event-driven backend platform',
  'a reliable deployment workflow',
  'an accessible product experience',
  'an efficient caching strategy',
  'a real-time analytics feature',
]

function createQuestionBank() {
  const bank = []
  const currentYear = new Date().getFullYear()
  let nextId = 1

  for (let year = 2015; year <= currentYear; year += 1) {
    for (let index = 0; index < 10; index += 1) {
      const company = companyList[(year + index) % companyList.length]
      const category = categoryList[(year + index) % categoryList.length]
      const topic = topicList[(year + index) % topicList.length]
      bank.push({
        id: nextId,
        company,
        question: `How would you design ${topic} for ${company} in ${year}?`,
        answer: `Start with requirements, highlight trade-offs, show how you would test it, and explain how you would measure success for ${company}'s scale.`,
        category,
        year,
      })
      nextId += 1
    }
  }

  return bank
}

const questions = createQuestionBank()
const recentQuestions = questions.slice(-120)
const dbPath = process.env.DB_PATH ? path.resolve(process.cwd(), process.env.DB_PATH) : path.join(process.cwd(), 'data', 'app.sqlite')
const jwtSecret = process.env.JWT_SECRET || 'dev-secret'

fs.mkdirSync(path.dirname(dbPath), { recursive: true })
const db = new Database(dbPath)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0,
    verification_code TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    answer TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`)

function getUserIdFromRequest(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return null
  }

  try {
    const payload = jwt.verify(token, jwtSecret)
    return payload.userId ?? null
  } catch {
    return null
  }
}

export function createAppServer() {
  return http.createServer((req, res) => {
    if (req.url === '/api/questions') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(recentQuestions))
      return
    }

    if (req.url === '/api/register' && req.method === 'POST') {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
      })
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}')
          const username = String(payload.username || '').trim()
          const email = String(payload.email || '').trim().toLowerCase()
          const password = String(payload.password || '')
          if (!username || !email || password.length < 4) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ error: 'Username, email, and password are required' }))
            return
          }

          const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email)
          if (existing) {
            res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ error: 'Username already exists' }))
            return
          }

          const verificationCode = `${Math.floor(100000 + Math.random() * 900000)}`
          const passwordHash = bcrypt.hashSync(password, 10)
          const insert = db.prepare('INSERT INTO users (username, email, password_hash, verification_code, email_verified) VALUES (?, ?, ?, ?, 0)')
          const result = insert.run(username, email, passwordHash, verificationCode)
          const emailResult = await sendVerificationEmail(email, verificationCode)
          const token = jwt.sign({ userId: result.lastInsertRowid }, jwtSecret)
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({
            user: { id: result.lastInsertRowid, username, email, emailVerified: false },
            token,
            requiresVerification: true,
            verificationCode,
            emailDelivery: emailResult,
          }))
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ error: 'Unable to create account' }))
        }
      })
      return
    }

    if (req.url === '/api/verify' && req.method === 'POST') {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
      })
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}')
          const email = String(payload.email || '').trim().toLowerCase()
          const code = String(payload.code || '')
          const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
          if (!user || user.verification_code !== code) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ error: 'Invalid verification code' }))
            return
          }
          db.prepare('UPDATE users SET email_verified = 1, verification_code = NULL WHERE id = ?').run(user.id)
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ user: { id: user.id, username: user.username, email: user.email, emailVerified: true } }))
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ error: 'Unable to verify account' }))
        }
      })
      return
    }

    if (req.url === '/api/login' && req.method === 'POST') {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
      })
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}')
          const username = String(payload.username || '').trim()
          const email = String(payload.email || '').trim().toLowerCase()
          const password = String(payload.password || '')
          const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username || email, email || username)
          if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ error: 'Invalid credentials' }))
            return
          }
          if (!user.email_verified) {
            res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ error: 'Please verify your email before signing in' }))
            return
          }
          const token = jwt.sign({ userId: user.id }, jwtSecret)
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ user: { id: user.id, username: user.username, email: user.email, emailVerified: Boolean(user.email_verified) }, token }))
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ error: 'Invalid request' }))
        }
      })
      return
    }

    if (req.url === '/api/answers') {
      const userId = getUserIdFromRequest(req)
      if (!userId) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'Login required' }))
        return
      }

      if (req.method === 'GET') {
        const answers = db.prepare('SELECT id, question_id AS questionId, answer, created_at AS createdAt FROM answers WHERE user_id = ? ORDER BY id DESC').all(userId)
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(answers))
        return
      }

      if (req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}')
            const insert = db.prepare('INSERT INTO answers (user_id, question_id, answer) VALUES (?, ?, ?)')
            const result = insert.run(userId, payload.questionId, payload.answer)
            const entry = db.prepare('SELECT id, question_id AS questionId, answer, created_at AS createdAt FROM answers WHERE id = ?').get(result.lastInsertRowid)
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(entry))
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ error: 'Invalid payload' }))
          }
        })
        return
      }
    }

    if (req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ status: 'ok', count: recentQuestions.length }))
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Not found' }))
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.url.replace('file://', ''))) {
  const server = createAppServer()
  server.listen(3001, '127.0.0.1', () => {
    console.log('API server listening on http://127.0.0.1:3001')
  })
}
