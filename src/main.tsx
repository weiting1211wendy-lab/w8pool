import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {
  clearLegacyPreviewMotto,
  cleanPreviewStickyNotes,
  seedImportedData,
} from './utils/seedImport.ts'
import { loadFromFileIfGranted } from './utils/filePersistence.ts'

async function bootstrap() {
  await loadFromFileIfGranted()
  seedImportedData()
  clearLegacyPreviewMotto()
  cleanPreviewStickyNotes()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
