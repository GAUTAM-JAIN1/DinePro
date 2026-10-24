// Shared alert-sound utility for the kitchen and reception panels.
// Browsers keep audio locked until a user gesture. A session restored from a
// saved login has no click, so the panel must say so and offer one (Bug #66).

let _audioContext = null
let _unlocked = false
let _blocked = false
const blockedListeners = new Set()

function setBlocked(next) {
  if (_blocked === next) return
  _blocked = next
  blockedListeners.forEach((fn) => fn(next))
}

function getContext() {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null
  if (!_audioContext) {
    _audioContext = new AudioContextClass()
    _audioContext.onstatechange = () => setBlocked(_audioContext.state !== 'running')
    setBlocked(_audioContext.state !== 'running')
  }
  return _audioContext
}

/** True while the browser won't play alert sounds yet. */
export function isAudioBlocked() {
  return _blocked
}

/** Calls fn(blocked) whenever that changes. Returns an unsubscribe function. */
export function onAudioBlockedChange(fn) {
  blockedListeners.add(fn)
  return () => {
    blockedListeners.delete(fn)
  }
}

// Call from a click or tap handler. Resumes audio and clears the blocked state.
export function unlockAudio() {
  const ctx = getContext()
  if (!ctx) return
  const finish = () => setBlocked(ctx.state !== 'running')
  if (ctx.state === 'suspended') {
    ctx.resume().then(finish).catch(() => setBlocked(true))
  } else {
    finish()
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
// If the context is suspended, tries to resume it and retries once. When that
// fails, the blocked state is set so the panel can show the "Sound on" banner.
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
    ctx.resume()
      .then(() => { setBlocked(false); fire() })
      .catch(() => {
        setBlocked(true)
        // Some browsers need a beat before resume is accepted
        setTimeout(() => {
          ctx.resume()
            .then(() => { setBlocked(false); fire() })
            .catch(() => setBlocked(true))
        }, 200)
      })
  } else {
    setBlocked(false)
    fire()
  }
}

export function isAudioUnlocked() {
  return _unlocked
}
