import { useMemo, useState } from 'react'
import './App.css'

type Question = {
  id: number
  company: string
  question: string
  answer: string
  category: string
  year: number
}

function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useMemo(() => {
    const load = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/questions')
        const data = (await response.json()) as Question[]
        setQuestions(data)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const filteredQuestions = useMemo(() => {
    const query = search.toLowerCase()
    return questions.filter((item) => {
      return [item.company, item.question, item.category, String(item.year)].some((value) => value.toLowerCase().includes(query))
    })
  }, [questions, search])

  return (
    <main className="app-shell">
      <section className="panel hero-panel">
        <p className="eyebrow">Question library</p>
        <h1>Explore 100k+ interview prompts</h1>
        <p className="lead">Search by company, year, category, or topic and jump straight into your next practice session.</p>
        <div className="hero-actions">
          <a className="pill-link" href="/">Back to dashboard</a>
          <a className="pill-link" href="/interview">Open AI interview</a>
        </div>
      </section>

      <section className="panel results-panel">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company, year, or category" />
        <div className="stats-grid" style={{ marginTop: '1rem' }}>
          <article className="stat-card">
            <p className="stat-label">Loaded</p>
            <strong>{loading ? '...' : filteredQuestions.length}</strong>
          </article>
          <article className="stat-card">
            <p className="stat-label">Companies</p>
            <strong>{new Set(questions.map((item) => item.company)).size}</strong>
          </article>
        </div>
        <ul className="question-list">
          {filteredQuestions.map((item) => (
            <li key={item.id} className="question-card">
              <div className="meta">
                <span className="category">{item.category}</span>
                <span className="id">{item.company} • {item.year}</span>
              </div>
              <h2>{item.question}</h2>
              <p className="sample-answer">{item.answer}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default QuestionsPage
