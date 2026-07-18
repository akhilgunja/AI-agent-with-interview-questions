import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import QuestionsPage from './QuestionsPage.tsx'
import InterviewPage from './InterviewPage.tsx'

const path = window.location.pathname

let page = <App />
if (path === '/questions') {
  page = <QuestionsPage />
} else if (path === '/interview') {
  page = <InterviewPage />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {page}
  </StrictMode>,
)
