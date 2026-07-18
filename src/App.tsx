import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Question = {
  id: number
  question: string
  answer: string
  category: string
  year: number
}

type InterviewAnswer = {
  questionId: number
  answer: string
}

function App() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [status, setStatus] = useState('Loading questions...')
  const [error, setError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<InterviewAnswer[]>([])
  const [draftAnswer, setDraftAnswer] = useState('')

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

  const saveAnswer = () => {
    if (!currentQuestion) {
      return
    }

    const nextAnswers = answers.filter((entry) => entry.questionId !== currentQuestion.id)
    nextAnswers.push({ questionId: currentQuestion.id, answer: draftAnswer.trim() })
    setAnswers(nextAnswers)
    setDraftAnswer('')

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((value) => value + 1)
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
          These questions come from the last 10 years and you can also answer them as part of a mini interview session.
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
              <button type="button" onClick={saveAnswer}>
                Save answer
              </button>
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
