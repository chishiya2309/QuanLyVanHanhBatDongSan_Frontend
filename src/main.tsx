import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { createRecoveryBootstrap } from './utils/recoveryNavigation'

const recoveryEntry = createRecoveryBootstrap()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App initialRecovery={recoveryEntry} />
  </StrictMode>,
)
