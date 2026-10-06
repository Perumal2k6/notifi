import { useCallback, useEffect, useRef, useState } from 'react'

export default function useAudio(source, onError, options = {}) {
  const currentAudioRef = useRef(null)
  const timerRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.oncanplaythrough = null
      currentAudioRef.current.onerror = null
      currentAudioRef.current.onended = null
      currentAudioRef.current.currentTime = 0
      currentAudioRef.current.src = ''
      currentAudioRef.current = null
    }
    setIsPlaying(false)
  }, [])

  useEffect(() => () => {
    stop()
  }, [stop])

  const play = useCallback(async () => {
    const defaultFallbackUrl = '/sounds/default-alarm.wav'
    const urlsToTry = [source, defaultFallbackUrl].filter(Boolean)

    // Remove duplicates if source is already the fallback
    const uniqueUrls = [...new Set(urlsToTry)]

    if (uniqueUrls.length === 0) {
      onError?.({ type: 'missing', url: '' })
      return false
    }

    for (let i = 0; i < uniqueUrls.length; i++) {
      const playUrl = uniqueUrls[i]
      const isFallback = i > 0

      stop()
      const audio = new Audio(playUrl)
      audio.preload = 'auto'
      audio.currentTime = 0
      if (options.loop) audio.loop = true
      
      currentAudioRef.current = audio
      
      let reported = false
      const report = details => {
        if (reported) return
        reported = true
        console.error(`[Audio] Error: ${details.type} - ${details.name} - ${details.message}`)
        
        if (isFallback || i === uniqueUrls.length - 1) {
          stop()
          onError?.({ ...details, url: playUrl })
        } else {
          console.warn(`Falling back to default sound because ${playUrl} failed.`)
        }
      }

      audio.onload = () => console.log(`[Audio] Loading URL: ${playUrl}`)
      audio.oncanplay = () => console.log(`[Audio] Loading URL: ${playUrl} (can play)`)
      audio.oncanplaythrough = () => console.log(`[Audio] Loading URL: ${playUrl} (can play through)`)
      audio.onerror = () => report({ type: 'load', code: audio.error?.code, message: audio.error?.message })
      audio.onended = () => { 
        if (!options.loop) stop() 
      }

      try {
        console.log(`[Audio] Playing: ${playUrl}`)
        await audio.play()
        setIsPlaying(true)
        if (options.timeout) {
          timerRef.current = setTimeout(() => stop(), options.timeout)
        }
        return true // Success! Stop trying URLs
      } catch (error) {
        if (error?.name === 'AbortError') return false; // Ignore AbortError caused by rapid unmounts
        
        // If it's a playback restriction, don't try the fallback (it will just fail again)
        if (error?.name === 'NotAllowedError') {
          report({ type: 'restriction', name: error?.name, message: error?.message })
          return false
        }
        
        // Otherwise, report playback error (this might trigger the fallback loop to continue)
        report({ type: 'playback', name: error?.name, message: error?.message })
      }
    }
    return false
  }, [onError, source, stop, options.loop, options.timeout])

  return { isPlaying, play, stop }
}
