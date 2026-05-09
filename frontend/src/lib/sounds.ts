// Sound effects utility for GARU
// Uses Web Audio API for better performance

class SoundManager {
  private audioContext: AudioContext | null = null
  private enabled: boolean = true
  private gameMusic: HTMLAudioElement | null = null
  private gameMusicBuffer: AudioBuffer | null = null
  private gameMusicSource: AudioBufferSourceNode | null = null
  private gameMusicGain: GainNode | null = null
  private readonly soundFiles: Record<string, string> = {
    correct: '/sounds/correct.mp3',
    wrong: '/sounds/wrong.mp3',
    click: '/sounds/click.mp3',
    victory: '/sounds/victory.mp3',
    reveal: '/sounds/reveal.mp3',
    warning: '/sounds/warning.mp3',
    draft: '/sounds/draft.mp3',
    battleStart: '/sounds/battle-start.mp3',
    startGame: '/sounds/ive-got-this.mp3',
    gameMusic: '/sounds/nba.mp3',
    right1: '/sounds/faaah.mp3',
    right2: '/sounds/green-giant-instant.mp3',
    right3: '/sounds/rizz-sound-effect.mp3',
    onFire: '/sounds/hes-on-fire.mp3',
    final1: '/sounds/is-this-the-dagger.mp3',
    final2: '/sounds/yahoo.mp3',
    wrong1: '/sounds/eatbulaga.mp3',
  }

  private readonly rightPool = ['right1', 'right2', 'right3'] as const
  private readonly wrongPool = ['wrong1', 'wrong'] as const
  private readonly finalPool = ['final1', 'final2'] as const

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return this.audioContext
  }

  private playFile(effect: keyof SoundManager['soundFiles'], fallback: () => void) {
    if (!this.isEnabled()) return

    try {
      const audio = new Audio(this.soundFiles[effect])
      audio.volume = 0.55
      void audio.play().catch(() => fallback())
    } catch {
      fallback()
    }
  }

  private pickRandom<T>(items: readonly T[]): T {
    return items[Math.floor(Math.random() * items.length)]
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

  // Warm up audio context + cache a tiny silent play to reduce first-play delay.
  async warmUp(): Promise<void> {
    if (typeof window === 'undefined') return

    try {
      const ctx = this.getContext()
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }
    } catch {
      // no-op
    }

    try {
      const audio = new Audio(this.soundFiles.click)
      audio.volume = 0
      await audio.play().catch(() => {})
      audio.pause()
      audio.currentTime = 0
    } catch {
      // no-op
    }
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
    this.playFile('correct', () => {
      this.playTone(523.25, 0.1, 'sine', 0.3) // C5
      setTimeout(() => this.playTone(659.25, 0.1, 'sine', 0.3), 100) // E5
      setTimeout(() => this.playTone(783.99, 0.15, 'sine', 0.3), 200) // G5
    })
  }

  // Wrong answer sound - descending sad tone
  wrong() {
    this.playFile('wrong', () => {
      this.playTone(392, 0.15, 'sawtooth', 0.2) // G4
      setTimeout(() => this.playTone(311.13, 0.2, 'sawtooth', 0.2), 150) // Eb4
    })
  }

  // Button click sound
  click() {
    this.playFile('click', () => this.playTone(800, 0.05, 'sine', 0.15))
  }

  // Success/Victory sound
  victory() {
    this.playFile('victory', () => {
      const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.15, 'sine', 0.25), i * 100)
      })
    })
  }

  // Reveal/Unlock sound
  reveal() {
    this.playFile('reveal', () => {
      this.playTone(440, 0.1, 'triangle', 0.2)
      setTimeout(() => this.playTone(554.37, 0.15, 'triangle', 0.2), 100)
    })
  }

  // Timer warning sound
  warning() {
    this.playFile('warning', () => this.playTone(880, 0.1, 'square', 0.15))
  }

  // Draft pick sound
  draft() {
    this.playFile('draft', () => {
      this.playTone(261.63, 0.1, 'sine', 0.3)
      setTimeout(() => this.playTone(329.63, 0.1, 'sine', 0.3), 80)
      setTimeout(() => this.playTone(392, 0.15, 'sine', 0.3), 160)
    })
  }

  // Battle start sound
  battleStart() {
    this.playFile('battleStart', () => {
      const notes = [196, 261.63, 329.63, 392]
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.12, 'sawtooth', 0.2), i * 80)
      })
    })
  }

  // Custom game mapping: play when start button is clicked.
  startGame() {
    this.playFile('startGame', () => this.click())
  }

  // Custom game mapping: low-volume loop during gameplay.
  async startGameMusicLoop() {
    if (!this.isEnabled()) return
    if (this.gameMusicSource || this.gameMusic) return

    // Prefer Web Audio looping to minimize audible loop gaps.
    try {
      const ctx = this.getContext()

      if (!this.gameMusicBuffer) {
        const response = await fetch(this.soundFiles.gameMusic)
        const arrayBuffer = await response.arrayBuffer()
        this.gameMusicBuffer = await ctx.decodeAudioData(arrayBuffer)
      }

      const source = ctx.createBufferSource()
      const gainNode = ctx.createGain()
      source.buffer = this.gameMusicBuffer
      source.loop = true

      // Trim tiny edges to avoid encoder padding clicks/gaps in MP3 loops.
      const duration = this.gameMusicBuffer.duration
      const trim = Math.min(0.08, duration * 0.02)
      source.loopStart = trim
      source.loopEnd = Math.max(duration - trim, trim + 0.1)

      gainNode.gain.value = 0.12
      source.connect(gainNode)
      gainNode.connect(ctx.destination)
      source.start()

      this.gameMusicSource = source
      this.gameMusicGain = gainNode

      source.onended = () => {
        if (this.gameMusicSource === source) {
          this.gameMusicSource = null
          this.gameMusicGain = null
        }
      }

      return
    } catch {
      // Fall through to HTMLAudio fallback
    }

    try {
      const music = new Audio(this.soundFiles.gameMusic)
      music.loop = true
      music.volume = 0.12
      this.gameMusic = music
      void music.play().catch(() => {
        this.gameMusic = null
      })
    } catch {
      this.gameMusic = null
    }
  }

  stopGameMusicLoop() {
    if (this.gameMusicSource) {
      try {
        this.gameMusicSource.stop()
      } catch {
        // no-op
      }
      this.gameMusicSource.disconnect()
      this.gameMusicSource = null
    }
    if (this.gameMusicGain) {
      this.gameMusicGain.disconnect()
      this.gameMusicGain = null
    }

    if (!this.gameMusic) return
    this.gameMusic.pause()
    this.gameMusic.currentTime = 0
    this.gameMusic = null
  }

  // Custom game mapping for correct answers across all games.
  // Every 5-streak plays on-fire. Final question can use dagger/yahoo.
  gameCorrect(streak: number, isFinalQuestion: boolean = false) {
    if (isFinalQuestion) {
      const effect = this.pickRandom(this.finalPool)
      this.playFile(effect, () => this.correct())
      return
    }
    if (streak > 0 && streak % 5 === 0) {
      this.playFile('onFire', () => this.correct())
      return
    }
    const effect = this.pickRandom(this.rightPool)
    this.playFile(effect, () => this.correct())
  }

  // Custom game mapping for wrong answers across all games.
  gameWrong() {
    const effect = this.pickRandom(this.wrongPool)
    this.playFile(effect, () => this.wrong())
  }

  // Preload all sound files for instant playback (non-blocking)
  async preloadSounds(): Promise<void> {
    if (typeof window === 'undefined') return
    
    const soundKeys = Object.keys(this.soundFiles) as Array<keyof SoundManager['soundFiles']>
    // Start preloading in background without blocking
    soundKeys.forEach(key => {
      const audio = new Audio(this.soundFiles[key])
      audio.preload = 'auto'
      audio.volume = 0
      // Attempt to play and pause silently to trigger full cache
      audio.play().catch(() => {
        // Ignore autoplay errors
      }).finally(() => {
        audio.pause()
        audio.currentTime = 0
      })
    })
  }
}

// Export both the class and a singleton instance
export { SoundManager }
export const sounds = new SoundManager()
