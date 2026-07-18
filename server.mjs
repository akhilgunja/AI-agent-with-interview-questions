import path from 'node:path'
import fs from 'node:fs'
import http from 'node:http'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { fileURLToPath } from 'node:url'
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

function createQuestionBank(size = 10000) {
  const bank = []
  const currentYear = new Date().getFullYear()
  let nextId = 1

  for (let index = 0; index < size; index += 1) {
    const year = 2015 + (index % 12)
    const company = companyList[index % companyList.length]
    const category = categoryList[(index + 3) % categoryList.length]
    const topic = topicList[index % topicList.length]
    const normalizedYear = Math.min(year, currentYear)
    bank.push({
      id: nextId,
      company,
      question: `How would you design ${topic} for ${company} in ${normalizedYear}?`,
      answer: `Start with requirements, highlight trade-offs, show how you would test it, and explain how you would measure success for ${company}'s scale.`,
      category,
      year: normalizedYear,
    })
    nextId += 1
  }

  return bank
}

const questions = createQuestionBank(10000)
const recentQuestions = questions.slice(-120)
const dbPath = process.env.DB_PATH ? path.resolve(process.cwd(), process.env.DB_PATH) : path.join(process.cwd(), 'data', 'app.sqlite')
const jwtSecret = process.env.JWT_SECRET || 'dev-secret'

fs.mkdirSync(path.dirname(dbPath), { recursive: true })
const db = new Database(dbPath)
const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").get()
if (!tableInfo) {
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      email_verified INTEGER NOT NULL DEFAULT 0,
      verification_code TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
} else {
  const columns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name)
  if (!columns.includes('email')) {
    db.exec('ALTER TABLE users ADD COLUMN email TEXT')
  }
  if (!columns.includes('email_verified')) {
    db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0')
  }
  if (!columns.includes('verification_code')) {
    db.exec('ALTER TABLE users ADD COLUMN verification_code TEXT')
  }
}

db.exec(`
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

function getRequestPath(url) {
  if (!url) {
    return ''
  }
  const parsed = new URL(url, 'http://127.0.0.1')
  return parsed.pathname
}

export function createAppServer() {
  return http.createServer((req, res) => {
    const pathname = getRequestPath(req.url)
    if (pathname === '/api/questions') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(questions))
      return
    }

    if (pathname === '/api/register' && req.method === 'POST') {
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

    if (pathname === '/api/verify' && req.method === 'POST') {
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
          const token = jwt.sign({ userId: user.id }, jwtSecret)
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({
            user: { id: user.id, username: user.username, email: user.email, emailVerified: true },
            token,
          }))
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ error: 'Unable to verify account' }))
        }
      })
      return
    }

    if (pathname === '/api/login' && req.method === 'POST') {
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

    if (pathname === '/api/answers') {
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

    if (pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ status: 'ok', count: recentQuestions.length }))
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Not found' }))
  })
}

const currentFile = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const server = createAppServer()
  const port = Number(process.env.PORT || 3001)
  server.listen(port, '127.0.0.1', () => {
    console.log(`API server listening on http://127.0.0.1:${port}`)
  })
}
