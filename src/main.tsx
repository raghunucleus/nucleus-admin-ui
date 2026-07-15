import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from '@/components/theme-provider'

// Auth used to persist in localStorage; we now scope it per-tab via sessionStorage.
// Strip any leftover entry so old tokens don't linger after the upgrade.
try {
  localStorage.removeItem('nucleus-auth-v2')
} catch {
  /* ignore — storage may be unavailable in some embeddings */
}

const googleClientId = import.meta.env.VITE_GOOGLE_OIDC_CLIENT_ID as string | undefined

const tree = (
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="nucleus-admin-theme">
      <App />
    </ThemeProvider>
  </StrictMode>
)

createRoot(document.getElementById('root')!).render(
  googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>
  ) : (
    tree
  ),
)
