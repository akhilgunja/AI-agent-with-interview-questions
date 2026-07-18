import { useEffect, useMemo, useState } from 'react'
import { login, register } from './auth'
import './App.css'

type Question = {
  id: number
  question: string
  answer: string
  category: string
  year: number
}

type InterviewAnswer = {
  id: number
  questionId: number
  answer: string
  createdAt: string
}

function App() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [status, setStatus] = useState('Loading questions...')
  const [error, setError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<InterviewAnswer[]>([])
  const [draftAnswer, setDraftAnswer] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const currentQuestion = questions[currentIndex]
  const answeredCount = useMemo(() => answers.length, [answers])

  const loadQuestions = async () => {
    setStatus('Loading questions...')
    setError(null)

    try {
      const response = await fetch('/api/questions')
      if (!response.ok) {
        throw new Error('Unable to load questions from the API')
      }

      const data = (await response.json()) as Question[]
      setQuestions(data)
      setStatus(`Loaded ${data.length} recent questions from the last 10 years`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error'
      setError(message)
      setStatus('Connection issue')
    }
  }

  const loadAnswers = async (authToken: string) => {
    try {
      const response = await fetch('/api/answers', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (!response.ok) {
        throw new Error('Unable to load saved answers')
      }
      const data = (await response.json()) as InterviewAnswer[]
      setAnswers(data)
    } catch {
      setStatus('Saved answers unavailable')
    }
  }

  const saveAnswer = async () => {
    if (!currentQuestion || !draftAnswer.trim()) {
      setSavedMessage('Please write an answer before saving.')
      return
    }
    if (!token) {
      setSavedMessage('Please sign in first.')
      return
    }

    setSaving(true)
    setSavedMessage('')

    try {
      const response = await fetch('/api/answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questionId: currentQuestion.id, answer: draftAnswer.trim() }),
      })

      if (!response.ok) {
        throw new Error('Unable to save answer')
      }

      const nextEntry = (await response.json()) as InterviewAnswer
      setAnswers((value) => [...value, nextEntry])
      setDraftAnswer('')
      setSavedMessage('Answer saved to the database.')
      if (currentIndex < questions.length - 1) {
        setCurrentIndex((value) => value + 1)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error'
      setError(message)
      setSavedMessage('')
    } finally {
      setSaving(false)
    }
  }

  const handleAuth = async () => {
    try {
      const authResponse = mode === 'login'
        ? await login(username, password)
        : await register(username, password)
      setToken(authResponse.token)
      setError(null)
      setStatus(`Signed in as ${authResponse.user.username}`)
      await loadAnswers(authResponse.token)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error'
      setError(message)
    }
  }

  useEffect(() => {
    void loadQuestions()
  }, [])

  return (
    <main className="app-shell">
      <section className="panel hero-panel">
        <p className="eyebrow">Frontend + backend demo</p>
        <h1>Interview Question Studio</h1>
        <p className="lead">
          These questions come from the last 10 years and you can save your interview answers in a real SQLite database.
        </p>
        <button type="button" onClick={() => void loadQuestions()}>
          Refresh questions
        </button>
      </section>

      <section className="panel results-panel">
        <div className="status-row">
          <span>{status}</span>
          {error ? <span className="error-badge">{error}</span> : null}
        </div>

        <div className="auth-box">
          <div className="auth-switch">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
              Login
            </button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
              Register
            </button>
          </div>
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" />
          <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
          <button type="button" onClick={() => void handleAuth()}>
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </div>

        <div className="interview-box">
          <div className="progress">Question {Math.min(currentIndex + 1, questions.length)} of {questions.length}</div>
          {currentQuestion ? (
            <>
              <div className="meta">
                <span className="category">{currentQuestion.category}</span>
                <span className="id">{currentQuestion.year}</span>
              </div>
              <h2>{currentQuestion.question}</h2>
              <p className="sample-answer">Sample answer: {currentQuestion.answer}</p>
              <textarea
                value={draftAnswer}
                onChange={(event) => setDraftAnswer(event.target.value)}
                placeholder="Type your interview answer here..."
              />
              <button type="button" onClick={() => void saveAnswer()} disabled={saving || !token}>
                {saving ? 'Saving...' : 'Save answer'}
              </button>
              {savedMessage ? <p className="saved-message">{savedMessage}</p> : null}
            </>
          ) : (
            <p>No questions loaded yet.</p>
          )}
        </div>

        <div className="answer-summary">
          <strong>{answeredCount}</strong> answer{answeredCount === 1 ? '' : 's'} saved
        </div>

        <ul className="question-list">
          {questions.map((item) => (
            <li key={item.id} className="question-card">
              <div className="meta">
                <span className="category">{item.category}</span>
                <span className="id">{item.year}</span>
              </div>
              <h2>{item.question}</h2>
              <p>{item.answer}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
