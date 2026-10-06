import { Pause, Play, Square, Volume2 } from 'lucide-react'
import useAudio from '../../hooks/useAudio'
import { toast } from 'sonner'

export default function SoundPreview({ sound, compact = false }) {
  const directSource = sound?.url || sound?.soundUrl || ''
  const source = directSource
  const handleAudioError = details => {
    console.error('Unable to play sound:', { soundId: sound?.soundId, soundType: sound?.soundType, soundUrl: source, soundName: sound?.name, error: details })
    if (details?.type === 'missing' || details?.type === 'load') toast.error('Sound file could not be loaded.')
    else if (details?.type === 'restriction') toast.error('Browser playback restriction: click Test Sound to allow audio playback.')
    else if (details?.type === 'playback') toast.error('Unsupported audio format or invalid audio URL.')
    else toast.error('Unable to play this audio. Check that the audio file exists and is supported by your browser.')
  }
  const { isPlaying, play, stop } = useAudio(source, handleAudioError)
  if (!sound) return null
  const handleTestSound = async () => { console.log({ soundId: sound?.soundId || sound?.id, soundType: sound?.soundType || 'default', soundUrl: source, soundName: sound?.name }); await play() }
  return <div className={'sound-preview ' + (compact ? 'compact' : '')}>
    <div className="sound-preview-name"><Volume2 size={15} /> <span>{sound.name}</span></div>
    <button type="button" className="secondary-btn sound-test-btn" onClick={isPlaying ? stop : handleTestSound}>
      {isPlaying ? <><Square size={14} /> Stop Sound</> : <><Play size={14} /> Test Sound</>}
    </button>
    {isPlaying && <span className="sound-playing"><Pause size={12} /> Playing...</span>}
  </div>
}
