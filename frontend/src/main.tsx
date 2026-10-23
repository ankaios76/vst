import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

/* Manrope, self-hosted über @fontsource/manrope (SIL OFL).
   Nur die vier Schnitte, die die Oberfläche tatsächlich benutzt:
   400 normal, 500 font-medium, 600 font-semibold, 700 font-bold.
   Jede Datei bringt ihre unicode-range mit, latin-ext lädt der Browser
   nur nach, wenn ein Zeichen daraus vorkommt. */
import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-500.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'
import '@fontsource/manrope/latin-ext-400.css'
import '@fontsource/manrope/latin-ext-500.css'
import '@fontsource/manrope/latin-ext-600.css'
import '@fontsource/manrope/latin-ext-700.css'

import './tokens.css'
import './index.css'
import { I18nProvider } from './context/I18nContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
)
