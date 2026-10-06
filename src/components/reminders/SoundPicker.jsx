import { Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import SoundPreview from './SoundPreview'
import SoundUploader from './SoundUploader'

export default function SoundPicker({ value, onChange, sounds }) {
  const [missingSounds, setMissingSounds] = useState([])
  useEffect(() => {
    let cancelled = false
    Promise.all(sounds.filter(sound => !sound.isCustom).map(async sound => {
      try {
        const response = await fetch(sound.url, { headers: { Range: 'bytes=0-1' } })
        return response.ok ? null : sound.name
      } catch {
        return sound.name
      }
    })).then(results => { if (!cancelled) setMissingSounds(results.filter(Boolean)) })
    return () => { cancelled = true }
  }, [sounds])
  const selected = value || sounds[0] || null
  const chooseSound = event => { onChange(sounds.find(item => item.id === event.target.value) || null) }
  return <div className="sound-picker">
    <label>Alarm sound <span>*</span></label>
    <select className="select" value={selected?.id || ''} onChange={chooseSound}>
      {!selected && <option value="">No sounds available</option>}
      {sounds.map(sound => <option value={sound.id} key={sound.id}>{sound.name}</option>)}
    </select>
    <SoundUploader value={value?.isCustom ? value : null} onChange={onChange} />
    {missingSounds.length > 0 && <div className="sound-missing">Missing default files: {missingSounds.join(', ')}</div>}
    {selected && <div className="selected-sound-label"><Volume2 size={14} /> Selected sound: <strong>{selected.name}</strong></div>}
    <SoundPreview sound={selected} />
  </div>
}
