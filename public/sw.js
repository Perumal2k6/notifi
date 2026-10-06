const ACTIONS_KEY = 'smart_reminder_pending_push_actions'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  console.log('[Service Worker] Push event received', event)
  if (!event.data) {
    console.warn('[Service Worker] Push event received but no data payload.')
    return
  }
  const data = event.data.json()
  console.log('[Service Worker] Push event data:', data)
  event.waitUntil(self.registration.showNotification(data.title || 'Smart Reminder', {
    body: data.body || 'Reminder due now',
    tag: data.tag || `smart-reminder-${data.reminderId || 'notification'}`,
    data,
    requireInteraction: true,
    silent: false,
    icon: '/favicon.ico',
    actions: [{ action: 'snooze', title: 'Snooze' }, { action: 'dismiss', title: 'Off' }],
  }).then(() => {
    console.log('[Service Worker] showNotification success.')
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  }).then((clients) => {
    clients.forEach(client => {
      client.postMessage({ type: 'SMART_REMINDER_PUSH_TRIGGER', payload: data })
    })
  }).catch((err) => {
    console.error('[Service Worker] showNotification error:', err)
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const action = event.action

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    
    if (!action) {
      // Clicked the body
      if (clientsList.length > 0) {
        const client = clientsList[0]
        await client.focus()
        client.postMessage({ type: 'SMART_REMINDER_NAVIGATE', payload: { reminderId: event.notification.data?.reminderId } })
      } else {
        await self.clients.openWindow(`/?alarm=${event.notification.data?.reminderId || ''}`)
      }
      return
    }

    const payload = { 
      action, 
      reminderId: event.notification.data?.reminderId || null, 
      snooze_minutes: event.notification.data?.snooze_minutes || 5,
      at: Date.now() 
    }

    if (clientsList.length > 0) {
      const client = clientsList[0]
      client.postMessage({ type: 'SMART_REMINDER_PUSH_ACTION', payload })
      // For actions, do not steal focus unless necessary, but some OSes might require it.
    } else {
      // Safe fallback strategy when no client is open: 
      // Open the app with the action in the query string so the frontend can authenticate and execute it.
      await self.clients.openWindow(`/?action=${action}&reminderId=${payload.reminderId}&snooze=${payload.snooze_minutes}`)
    }
  })())
})
