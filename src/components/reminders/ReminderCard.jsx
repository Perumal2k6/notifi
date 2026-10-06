import { Bell, CalendarDays, Clock3, Pencil, Trash2, Volume2 } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import useCountdown, { formatCountdown } from '../../hooks/useCountdown'
import SoundPreview from './SoundPreview'

export default function ReminderCard({ reminder, onDelete, onToggle, onAlarm }) {
  const countdown = useCountdown(reminder)
  const sound = { name: reminder.soundName, soundType: reminder.isCustom ? 'custom' : 'default', url: reminder.soundUrl }
  const dateLabel = reminder.date
  const isSnoozed = reminder.status === 'SNOOZED';
  return <article className="reminder-card">
    <div className="reminder-card-head"><div className="reminder-card-title"><span className="reminder-card-icon"><Bell size={17} /></span><div><h3>{reminder.title}</h3><p>{reminder.description || 'No description'}</p></div></div><span className={'badge ' + (!reminder.active ? 'off' : isSnoozed ? 'orange' : '')}>{!reminder.active ? 'Off' : isSnoozed ? 'Snoozed' : 'Active'}</span></div>
    <div className="reminder-meta"><span><CalendarDays size={14} /> {dateLabel} · {formatTime(reminder.time)}</span><span><Volume2 size={14} /> {reminder.soundName}</span><span><Clock3 size={14} /> Snooze: {reminder.snoozeMinutes} min</span></div>
    <div className={'countdown-box ' + (countdown.due ? 'due' : '')}><span>{countdown.due ? '🔔 Due now' : (isSnoozed ? 'ALARM AGAIN IN' : 'Starts in')}</span><strong>{countdown.due ? 'Due now' : formatCountdown(countdown)}</strong></div>
    <div className="reminder-card-actions"><button type="button" className="secondary-btn" onClick={onAlarm}><Bell size={14} /> Test Alarm</button><SoundPreview sound={sound} compact /><NavLink className="small-icon" to={`/reminders/${reminder.id}/edit`} title="Edit"><Pencil size={15} /></NavLink><button type="button" className="small-icon" onClick={onToggle} title="Toggle active"><Clock3 size={15} /></button><button type="button" className="small-icon" onClick={onDelete} title="Delete"><Trash2 size={15} /></button></div>
  </article>
}
function formatTime(time) { const [hours, minutes] = time.split(':').map(Number); return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}` }
