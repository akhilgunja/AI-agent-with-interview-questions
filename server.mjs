import path from 'node:path'
import http from 'node:http'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const questions = [
  {
    id: 1,
    question: 'How would you explain React state updates to a junior developer?',
    answer: 'Use state to reflect UI data and update it through setter functions; keep state changes predictable and avoid mutating objects directly.',
    category: 'React',
    year: 2024,
  },
  {
    id: 2,
    question: 'What are the main differences between REST and GraphQL APIs?',
    answer: 'REST uses fixed endpoints and payloads, while GraphQL lets the client request only the fields it needs and is more flexible for evolving frontends.',
    category: 'API Design',
    year: 2023,
  },
  {
    id: 3,
    question: 'How do you optimize a web app for performance in 2024?',
    answer: 'Use code splitting, lazy loading, image optimization, caching, and measure bottlenecks with browser performance tools.',
    category: 'Performance',
    year: 2024,
  },
  {
    id: 4,
    question: 'What is the difference between useEffect and useLayoutEffect?',
    answer: 'useEffect runs after paint, while useLayoutEffect runs before paint and is useful for measuring layout or preventing visual flicker.',
    category: 'React',
    year: 2022,
  },
  {
    id: 5,
    question: 'How would you structure a scalable frontend project?',
    answer: 'Separate routes, components, services, and shared utilities; keep modules focused and use consistent naming and folder conventions.',
    category: 'Architecture',
    year: 2021,
  },
  {
    id: 6,
    question: 'What is the value of TypeScript in a large application?',
    answer: 'TypeScript catches many bugs early, improves editor support, and makes contracts between components clearer.',
    category: 'TypeScript',
    year: 2020,
  },
  {
    id: 7,
    question: 'How do you handle authentication securely in a frontend app?',
    answer: 'Use secure HTTP-only cookies or tokens issued by a backend service, keep secrets out of client code, and avoid storing sensitive data in local storage.',
    category: 'Security',
    year: 2023,
  },
  {
    id: 8,
    question: 'How would you improve accessibility in a React interface?',
    answer: 'Use semantic HTML, keyboard support, labels, contrast, and test with screen readers and accessibility tooling.',
    category: 'Accessibility',
    year: 2022,
  },
  {
    id: 9,
    question: 'What is the purpose of React Suspense?',
    answer: 'Suspense helps manage asynchronous rendering and lets the UI show fallbacks while data or code is still loading.',
    category: 'React',
    year: 2021,
  },
  {
    id: 10,
    question: 'How do you design error handling for a production web app?',
    answer: 'Create clear user-facing messages, log failures centrally, retry transient errors carefully, and surface actionable feedback.',
    category: 'Reliability',
    year: 2024,
  },
]

const currentYear = new Date().getFullYear()
const recentQuestions = questions.filter((item) => currentYear - item.year <= 10)
const dbPath = path.join(process.cwd(), 'data', 'app.sqlite')
const jwtSecret = process.env.JWT_SECRET || 'dev-secret'

const db = new Database(dbPath)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
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
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}')
          const passwordHash = bcrypt.hashSync(payload.password, 10)
          const insert = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
          const result = insert.run(payload.username, passwordHash)
          const token = jwt.sign({ userId: result.lastInsertRowid }, jwtSecret)
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ user: { id: result.lastInsertRowid, username: payload.username }, token }))
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ error: 'Unable to create account' }))
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
          const user = db.prepare('SELECT * FROM users WHERE username = ?').get(payload.username)
          if (!user || !bcrypt.compareSync(payload.password, user.password_hash)) {
            res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ error: 'Invalid credentials' }))
            return
          }
          const token = jwt.sign({ userId: user.id }, jwtSecret)
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ user: { id: user.id, username: user.username }, token }))
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
