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

function InterviewPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [draftAnswer, setDraftAnswer] = useState('')
  const [message, setMessage] = useState('Ready for your next live session')

  useMemo(() => {
    const load = async () => {
      const response = await fetch('/api/questions')
      const data = (await response.json()) as Question[]
      setQuestions(data)
    }
    void load()
  }, [])

  const currentQuestion = questions[currentIndex]

  const nextQuestion = () => {
    setCurrentIndex((value) => (value + 1) % Math.max(questions.length, 1))
    setDraftAnswer('')
    setMessage('Next prompt loaded')
  }

  return (
    <main className="app-shell">
      <section className="panel hero-panel">
        <p className="eyebrow">AI interview</p>
        <h1>Live interview practice</h1>
        <p className="lead">Use this page as a focused interview room with the question bank and a response area.</p>
        <div className="hero-actions">
          <a className="pill-link" href="/">Dashboard</a>
          <a className="pill-link" href="/questions">Question library</a>
        </div>
      </section>

      <section className="panel results-panel">
        <div className="interview-box">
          <div className="progress">Prompt {Math.min(currentIndex + 1, questions.length)} of {questions.length}</div>
          {currentQuestion ? (
            <>
              <div className="meta">
                <span className="category">{currentQuestion.category}</span>
                <span className="id">{currentQuestion.company} • {currentQuestion.year}</span>
              </div>
              <h2>{currentQuestion.question}</h2>
              <p className="sample-answer">Suggested direction: {currentQuestion.answer}</p>
              <textarea value={draftAnswer} onChange={(event) => setDraftAnswer(event.target.value)} placeholder="Record your response here..." />
              <div className="auth-actions">
                <button type="button" onClick={nextQuestion}>Next question</button>
                <button type="button" className="secondary" onClick={() => setMessage('Response saved locally for review')}>Save note</button>
              </div>
              <p className="saved-message">{message}</p>
            </>
          ) : (
            <p>Loading interview questions...</p>
          )}
        </div>
      </section>
    </main>
  )
}

export default InterviewPage
