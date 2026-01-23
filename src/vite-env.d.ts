/// <reference types="vite/client" />

// Tauri injects __TAURI__ into the window object when running in Tauri context
interface Window {
  __TAURI__?: Record<string, unknown>
}
