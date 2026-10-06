import { registerServiceWorker } from './services/pushService'

export default function registerAppServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null)
  return registerServiceWorker().catch(error => {
    console.error('Service worker registration failed:', error)
    return null
  })
}
