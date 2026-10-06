import { useEffect, useRef } from 'react'
import { getScheduledDate } from './useCountdown'

function getTriggerTime(reminder) {
  if (reminder.nextTriggerAt) return new Date(reminder.nextTriggerAt).getTime()
  return reminder.scheduledAt ? new Date(reminder.scheduledAt).getTime() : getScheduledDate(reminder.date, reminder.time)?.getTime() || 0
}

export default function useReminderScheduler(reminders, onDue) {
  const triggeredRef = useRef(new Set())
  const callbackRef = useRef(onDue)
  useEffect(() => { callbackRef.current = onDue }, [onDue])
  useEffect(() => {
    const check = () => {
      const now = Date.now()
      reminders.filter(reminder => reminder.active).forEach(reminder => {
        const triggerTime = getTriggerTime(reminder)
        const occurrence = `${reminder.id}:${triggerTime}`
        if (triggerTime > 0 && triggerTime <= now && !triggeredRef.current.has(occurrence)) {
          triggeredRef.current.add(occurrence)
          callbackRef.current(reminder)
        }
      })
    }
    check()
    const interval = window.setInterval(check, 1000)
    return () => window.clearInterval(interval)
  }, [reminders])
}
