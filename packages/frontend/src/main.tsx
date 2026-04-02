import React from 'react'
import ReactDOM from 'react-dom/client'
// @ts-expect-error JSX module is intentionally imported for frontend runtime.
import DotsBoxesEnhanced from './components/DotsBoxesEnhanced.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DotsBoxesEnhanced />
  </React.StrictMode>,
)
