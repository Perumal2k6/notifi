import { FileAudio, Replace, Trash2 } from 'lucide-react'
import { useState } from 'react'
import SoundPreview from './SoundPreview'
import { apiRequest, mapSound } from '../../services/api'
import { toast } from 'sonner'

export default function SoundUploader({ value, onChange }) {
  const [file, setFile] = useState(null)
  const selectFile = async event => {
    const nextFile = event.target.files?.[0]
    if (!nextFile) return
    try {
      const body = new FormData()
      body.append('file', nextFile)
      const sound = mapSound(await apiRequest('/sounds/upload', { method: 'POST', body }))
      setFile(nextFile)
      onChange(sound)
    } catch (error) {
      toast.error(`Unable to upload this audio file: ${error.message}`)
    }
    event.target.value = ''
  }
  const remove = async () => {
    if (value?.isCustom && value.id) {
      try {
        await apiRequest(`/sounds/${value.id}`, { method: 'DELETE' })
      } catch (error) {
        toast.error(`Unable to remove sound: ${error.message}`)
        return
      }
    }
    setFile(null)
    onChange(null)
  }
  return <div className="sound-uploader">
    <div className="sound-upload-label"><FileAudio size={15} /> Custom sound</div>
    {value?.isCustom ? <div className="custom-sound-row"><span title={file?.name || value.name}>{file?.name || value.name}</span><label className="secondary-btn file-btn"><Replace size={14} /> Replace<input type="file" accept="audio/*" onChange={selectFile} /></label><button type="button" className="small-icon" onClick={remove} title="Remove custom sound"><Trash2 size={15} /></button></div> : <label className="secondary-btn file-btn"><FileAudio size={14} /> Choose audio from device<input type="file" accept="audio/*" onChange={selectFile} /></label>}
    {value?.isCustom && <SoundPreview sound={value} compact />}
  </div>
}
