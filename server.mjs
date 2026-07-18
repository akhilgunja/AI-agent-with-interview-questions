import http from 'node:http'

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

const server = http.createServer((req, res) => {
  if (req.url === '/api/questions') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(recentQuestions))
    return
  }

  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ status: 'ok', count: recentQuestions.length }))
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(3001, '127.0.0.1', () => {
  console.log('API server listening on http://127.0.0.1:3001')
})
