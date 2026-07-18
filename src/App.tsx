import { useEffect, useMemo, useRef, useState } from 'react'
import { login, register, verifyEmail } from './auth'
import './App.css'

type Question = {
  id: number
  question: string
  answer: string
  category: string
  year: number
  company: string
}

type InterviewAnswer = {
  id: number
  questionId: number
  answer: string
  createdAt: string
}

type AuthMode = 'login' | 'register'

function App() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [status, setStatus] = useState('Loading questions...')
  const [error, setError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<InterviewAnswer[]>([])
  const [draftAnswer, setDraftAnswer] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [token, setToken] = useState<string | null>(() => (typeof window === 'undefined' ? null : window.localStorage.getItem('interview-token')))
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState(() => (typeof window === 'undefined' ? '' : (window.localStorage.getItem('interview-username') || '')))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(token))
  const [requiresVerification, setRequiresVerification] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceStatus, setVoiceStatus] = useState('Voice ready')
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  const currentQuestion = questions[currentIndex]
  const answeredCount = useMemo(() => answers.length, [answers])
  const categories = useMemo(() => {
    const counts = questions.reduce<Record<string, number>>((accumulator, question) => {
      accumulator[question.category] = (accumulator[question.category] || 0) + 1
      return accumulator
    }, {})
    return Object.entries(counts).slice(0, 4)
  }, [questions])

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
      setAnswers((value) => [nextEntry, ...value])
      setDraftAnswer('')
      setVoiceTranscript('')
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
    setError(null)
    setSavedMessage('')
    try {
      const authResponse = mode === 'login'
        ? await login(username, password, email)
        : await register(username, email, password)
      if (authResponse.requiresVerification) {
        setRequiresVerification(true)
        setSavedMessage('Account created. Verify the email with the code returned by the server.')
        setError(null)
        setStatus('Verification required')
        return
      }
      window.localStorage.setItem('interview-token', authResponse.token)
      window.localStorage.setItem('interview-username', authResponse.user.username)
      setToken(authResponse.token)
      setIsAuthenticated(true)
      setRequiresVerification(false)
      setStatus(`Signed in as ${authResponse.user.username}`)
      setSavedMessage(mode === 'login' ? 'Signed in successfully.' : 'Account created and signed in.')
      await loadAnswers(authResponse.token)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error'
      setError(message)
    }
  }

  const handleLogout = () => {
    window.localStorage.removeItem('interview-token')
    window.localStorage.removeItem('interview-username')
    setToken(null)
    setIsAuthenticated(false)
    setRequiresVerification(false)
    setAnswers([])
    setDraftAnswer('')
    setVoiceTranscript('')
    setSavedMessage('')
    setError(null)
    setPassword('')
    setVerificationCode('')
    setStatus('Signed out. Please sign in to continue.')
  }

  const handleVerify = async () => {
    try {
      await verifyEmail(email, verificationCode)
      setStatus('Email verified successfully')
      setSavedMessage('Email verified. You can sign in now.')
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error'
      setError(message)
    }
  }

  const startAudioInterview = () => {
    if (!currentQuestion) {
      setError('No question available yet.')
      return
    }

    if (typeof window === 'undefined') {
      return
    }

    const recognitionApi = (window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition
      || (window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition

    if (!recognitionApi) {
      setError('Speech recognition is not available in this browser.')
      setVoiceStatus('Browser unsupported')
      return
    }

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(currentQuestion.question)
      utterance.rate = 1
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    }

    recognitionRef.current?.stop()
    const recognition = new recognitionApi()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onresult = (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim()
      setVoiceTranscript(transcript)
      setDraftAnswer(transcript)
      setVoiceStatus(transcript ? 'Voice response captured' : 'Listening...')
    }
    recognition.onerror = () => {
      setIsListening(false)
      setVoiceStatus('Voice capture stopped')
    }
    recognition.onend = () => {
      setIsListening(false)
      setVoiceStatus('Voice capture complete')
      setSavedMessage(voiceTranscript ? 'Voice response captured. You can save it.' : 'Voice response captured. Try again if needed.')
    }
    recognition.start()
    recognitionRef.current = recognition
    setIsListening(true)
    setVoiceStatus('Listening for your answer...')
  }

  const stopAudioInterview = () => {
    recognitionRef.current?.stop()
    setIsListening(false)
    setVoiceStatus('Voice capture stopped')
  }

  useEffect(() => {
    void loadQuestions()
    if (typeof window === 'undefined') {
      return
    }
    const storedToken = window.localStorage.getItem('interview-token')
    const storedUsername = window.localStorage.getItem('interview-username')
    if (storedToken) {
      setToken(storedToken)
      setIsAuthenticated(true)
      setStatus(`Signed in as ${storedUsername || 'user'}`)
      void loadAnswers(storedToken)
    }
    const recognitionApi = (window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition
      || (window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition
    if (recognitionApi) {
      setSpeechSupported(true)
    }
  }, [])

  return (
    <main className="app-shell">
      <section className="panel hero-panel">
        <p className="eyebrow">Admin console</p>
        <h1>Interview Question Studio</h1>
        <p className="lead">
          Sign in, save interview answers, and run a voice-guided session with the same backend-driven dashboard.
        </p>
        <div className="hero-actions">
          <button type="button" onClick={() => void loadQuestions()}>
            Refresh questions
          </button>
          <a className="pill-link" href="/questions">Questions tab</a>
          <a className="pill-link" href="/interview">AI interview</a>
          <span className="pill">SQLite + JWT</span>
          {isAuthenticated ? <span className="pill">Session live</span> : <span className="pill">Login required</span>}
        </div>
      </section>

      <section className="panel results-panel">
        <div className="status-row">
          <span>{status}</span>
          {error ? <span className="error-badge">{error}</span> : null}
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <p className="stat-label">Questions</p>
            <strong>{questions.length}</strong>
          </article>
          <article className="stat-card">
            <p className="stat-label">Saved answers</p>
            <strong>{answeredCount}</strong>
          </article>
          <article className="stat-card">
            <p className="stat-label">Categories</p>
            <strong>{categories.length}</strong>
          </article>
        </div>

        <div className="dashboard-grid">
          <div className="left-column">
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
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" />
              <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
              {requiresVerification ? (
                <>
                  <input value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} placeholder="Verification code" />
                  <button type="button" className="secondary" onClick={() => void handleVerify()}>
                    Verify email
                  </button>
                </>
              ) : null}
              <div className="auth-actions">
                <button type="button" onClick={() => void handleAuth()}>
                  {mode === 'login' ? 'Sign in' : 'Create account'}
                </button>
                {isAuthenticated ? (
                  <button type="button" className="secondary" onClick={handleLogout}>
                    Logout
                  </button>
                ) : null}
              </div>
            </div>

            {isAuthenticated ? (
              <div className="interview-box">
                <div className="progress">Question {Math.min(currentIndex + 1, questions.length)} of {questions.length}</div>
                {currentQuestion ? (
                  <>
                    <div className="meta">
                      <span className="category">{currentQuestion.category}</span>
                      <span className="id">{currentQuestion.company} • {currentQuestion.year}</span>
                    </div>
                    <h2>{currentQuestion.question}</h2>
                    <p className="sample-answer">Sample answer: {currentQuestion.answer}</p>

                    <div className="voice-actions">
                      <button type="button" onClick={startAudioInterview} disabled={!speechSupported || isListening}>
                        {isListening ? 'Listening...' : 'Start audio call'}
                      </button>
                      <button type="button" className="secondary" onClick={stopAudioInterview} disabled={!isListening}>
                        Stop
                      </button>
                    </div>
                    <p className={`voice-badge ${isListening ? 'listening' : ''}`}>{voiceStatus}</p>
                    {voiceTranscript ? <p className="voice-transcript">{voiceTranscript}</p> : null}

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
            ) : (
              <div className="interview-box">
                <h2>Secure interview workspace</h2>
                <p className="sample-answer">Sign in to save answers and start your audio-guided interview session.</p>
              </div>
            )}
          </div>

          <div className="right-column">
            {isAuthenticated ? (
              <>
                <div className="answer-summary">
                  <h3>Saved answers</h3>
                  <p>{answeredCount} answer{answeredCount === 1 ? '' : 's'} stored in the database</p>
                </div>
                <ul className="question-list">
                  {answers.slice(0, 4).map((item) => (
                    <li key={item.id} className="answer-item">
                      <p className="answer-text">{item.answer}</p>
                      <span className="answer-meta">#{item.questionId} • {new Date(item.createdAt).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
                <div className="category-panel">
                  <h3>Question mix</h3>
                  <ul>
                    {categories.map(([name, count]) => (
                      <li key={name}><span>{name}</span><strong>{count}</strong></li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div className="category-panel">
                <h3>How it works</h3>
                <ul>
                  <li><span>1. Register or login</span></li>
                  <li><span>2. Start the audio call</span></li>
                  <li><span>3. Save your response</span></li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
