export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return Notification.permission
  return Notification.requestPermission()
}

export function showLocalNotification(reminder) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false
  const notification = new Notification('Smart Reminder', {
    body: `${reminder.title}\n${reminder.description || 'Reminder due now'}`,
    tag: `smart-reminder-${reminder.id}`,
    data: { reminderId: reminder.id },
  })
  notification.onclick = () => { window.focus(); notification.close() }
  return true
}
