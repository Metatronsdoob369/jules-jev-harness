import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

import ErrorBoundary from './components/ErrorBoundary.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary title="The harness encountered an unexpected state. Reload to restore session.">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
