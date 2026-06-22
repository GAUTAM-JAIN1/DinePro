// Shared, reliable alert-sound utility for chef-panel and receptionist-panel.
// Designed to survive browser autoplay restrictions and "silent fail" issues.

let _audioContext = null
let _unlocked = false

function getContext() {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null
  if (!_audioContext) {
    _audioContext = new AudioContextClass()
  }
  return _audioContext
}

// Browsers suspend AudioContext until a real user gesture happens (click/tap).
// Call this from your login button's onClick (or any click handler) ONCE —
// after that, sound will work reliably for the rest of the session.
export function unlockAudio() {
  const ctx = getContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
  if (!_unlocked) {
    // Play a near-silent buffer to fully unlock audio on some mobile browsers
    try {
      const buffer = ctx.createBuffer(1, 1, 22050)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start(0)
    } catch (e) { /* ignore */ }
  }
  _unlocked = true
}

function playSingleBeep(ctx, startTime, frequency = 880, duration = 0.18, volume = 0.5) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + startTime)
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + startTime)
  gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + startTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startTime + duration)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(ctx.currentTime + startTime)
  oscillator.stop(ctx.currentTime + startTime + duration + 0.02)
}

// Plays a strong, attention-grabbing 3-beep alert.
// Automatically tries to resume a suspended context (in case unlockAudio
// wasn't called, e.g. very first load), and retries once if blocked.
export function playAlert({ repeats = 3, gapMs = 380 } = {}) {
  const ctx = getContext()
  if (!ctx) return

  const fire = () => {
    for (let i = 0; i < repeats; i++) {
      const t = (i * gapMs) / 1000
      playSingleBeep(ctx, t, i % 2 === 0 ? 920 : 700, 0.22, 0.55)
    }
  }

  if (ctx.state === 'suspended') {
    ctx.resume().then(fire).catch(() => {
      // Retry once after a short delay — some browsers need a beat
      setTimeout(() => {
        ctx.resume().then(fire).catch(() => {})
      }, 200)
    })
  } else {
    fire()
  }
}

export function isAudioUnlocked() {
  return _unlocked
}