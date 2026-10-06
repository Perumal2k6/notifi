import { useEffect, useState } from 'react'

export function getScheduledDate(date, time) {
  if (!date || !time) return null
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  const scheduled = new Date()
  scheduled.setFullYear(year, month - 1, day)
  scheduled.setHours(hours, minutes, 0, 0)
  return scheduled
}

function getRemaining(milliseconds) {
  if (milliseconds <= 0) return { milliseconds: 0, days: 0, hours: 0, minutes: 0, seconds: 0, due: true }
  const totalSeconds = Math.floor(milliseconds / 1000)
  return {
    milliseconds,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    due: false,
  }
}

export default function useCountdown(reminder) {
  const targetTime = reminder?.status === "SNOOZED" && reminder?.nextTriggerAt 
    ? new Date(reminder.nextTriggerAt).getTime()
    : (getScheduledDate(reminder?.date, reminder?.time)?.getTime() || 0);

  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [targetTime])
  return getRemaining(targetTime - now)
}

export function formatCountdown(remaining) {
  if (remaining.due) return 'Due now'
  const pad = value => String(value).padStart(2, '0')
  if (remaining.days > 0) return `${remaining.days}d ${pad(remaining.hours)}h ${pad(remaining.minutes)}m`
  if (remaining.hours > 0) return `${pad(remaining.hours)}h ${pad(remaining.minutes)}m ${pad(remaining.seconds)}s`
  if (remaining.minutes > 0) return `${pad(remaining.minutes)}:${pad(remaining.seconds)}`
  return `00:${pad(remaining.seconds)}`
}
