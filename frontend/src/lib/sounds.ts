// Sound effects utility for GARU
// Uses Web Audio API for better performance

class SoundManager {
  private audioContext: AudioContext | null = null
  private enabled: boolean = true

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return this.audioContext
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (typeof window !== 'undefined') {
      localStorage.setItem('soundEnabled', String(enabled))
    }
  }

  isEnabled(): boolean {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('soundEnabled')
      if (stored !== null) {
        this.enabled = stored === 'true'
      }
    }
    return this.enabled
  }

  // Generate a simple beep sound
  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
    if (!this.isEnabled()) return
    
    try {
      const ctx = this.getContext()
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      oscillator.frequency.value = frequency
      oscillator.type = type
      
      gainNode.gain.setValueAtTime(volume, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
      
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + duration)
    } catch (e) {
      console.warn('Sound playback failed:', e)
    }
  }

  // Correct answer sound - ascending happy tone
  correct() {
    this.playTone(523.25, 0.1, 'sine', 0.3) // C5
    setTimeout(() => this.playTone(659.25, 0.1, 'sine', 0.3), 100) // E5
    setTimeout(() => this.playTone(783.99, 0.15, 'sine', 0.3), 200) // G5
  }

  // Wrong answer sound - descending sad tone
  wrong() {
    this.playTone(392, 0.15, 'sawtooth', 0.2) // G4
    setTimeout(() => this.playTone(311.13, 0.2, 'sawtooth', 0.2), 150) // Eb4
  }

  // Button click sound
  click() {
    this.playTone(800, 0.05, 'sine', 0.15)
  }

  // Success/Victory sound
  victory() {
    const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.15, 'sine', 0.25), i * 100)
    })
  }

  // Reveal/Unlock sound
  reveal() {
    this.playTone(440, 0.1, 'triangle', 0.2)
    setTimeout(() => this.playTone(554.37, 0.15, 'triangle', 0.2), 100)
  }

  // Timer warning sound
  warning() {
    this.playTone(880, 0.1, 'square', 0.15)
  }

  // Draft pick sound
  draft() {
    this.playTone(261.63, 0.1, 'sine', 0.3)
    setTimeout(() => this.playTone(329.63, 0.1, 'sine', 0.3), 80)
    setTimeout(() => this.playTone(392, 0.15, 'sine', 0.3), 160)
  }

  // Battle start sound
  battleStart() {
    const notes = [196, 261.63, 329.63, 392]
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.12, 'sawtooth', 0.2), i * 80)
    })
  }
}

// Export both the class and a singleton instance
export { SoundManager }
export const sounds = new SoundManager()
