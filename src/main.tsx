import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Auth used to persist in localStorage; we now scope it per-tab via sessionStorage.
// Strip any leftover entry so old tokens don't linger after the upgrade.
try {
  localStorage.removeItem('nucleus-auth-v2')
} catch {
  /* ignore — storage may be unavailable in some embeddings */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
