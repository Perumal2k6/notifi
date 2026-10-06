export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.register('/sw.js')
}

export async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.ready
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function subscribeToPush(publicKey) {
  if (!publicKey) throw new Error('A public VAPID key is required before subscribing to push.')
  
  console.log('[Push] Fetching Service Worker Registration...')
  const registration = await getServiceWorkerRegistration()
  if (!registration) throw new Error('Service worker is not registered.')
  
  console.log('[Push] Converting VAPID key to Uint8Array...')
  const applicationServerKey = urlBase64ToUint8Array(publicKey)
  
  let existingSub = await registration.pushManager.getSubscription()
  let subscription
  
  try {
    console.log('[Push] Requesting pushManager.subscribe()...')
    subscription = await registration.pushManager.subscribe({ 
      userVisibleOnly: true, 
      applicationServerKey 
    })
  } catch (error) {
    if (existingSub) {
      console.warn('[Push] Existing subscription might be revoked or keys mismatch. Unsubscribing...', error)
      await existingSub.unsubscribe()
      console.log('[Push] Retrying pushManager.subscribe()...')
      subscription = await registration.pushManager.subscribe({ 
        userVisibleOnly: true, 
        applicationServerKey 
      })
    } else {
      throw error
    }
  }
  
  console.log('[Push] Successfully created PushSubscription:', subscription.endpoint)
  return subscription
}
