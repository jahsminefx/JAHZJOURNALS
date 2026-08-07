import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { SEOProvider } from './context/SEOContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <SEOProvider>
        <App />
      </SEOProvider>
    </ErrorBoundary>
  </StrictMode>,
)
