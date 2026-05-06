import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

/* Flip a "fonts-loaded" class on <html> once the Material Symbols icon font is
 * actually available. The CSS in index.html keeps icon spans invisible until
 * this class appears, which prevents the ligature text ("grid_view",
 * "verified_user", etc.) from flashing on every page refresh.
 * If document.fonts isn't supported (very old browsers), fall back to setting
 * the class immediately — the icons will still render once the font arrives,
 * the user just briefly sees the raw ligature text on those browsers.        */
if (typeof document !== 'undefined') {
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      document.documentElement.classList.add('fonts-loaded');
    });
    /* Hard timeout — if the font request fails or stalls, un-hide icons after
     * 3s so the page is never permanently blank where icons should be. */
    setTimeout(() => document.documentElement.classList.add('fonts-loaded'), 3000);
  } else {
    document.documentElement.classList.add('fonts-loaded');
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
