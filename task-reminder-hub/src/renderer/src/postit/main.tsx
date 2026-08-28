import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import '../shared/tokens.css'
import './postit.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
