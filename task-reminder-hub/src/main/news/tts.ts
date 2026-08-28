/**
 * Camada de voz. A logica de noticias fala so com esta interface, entao
 * trocar a voz nativa do Windows por um servico em nuvem depois e trocar
 * a implementacao aqui — nada mais muda.
 */
export interface TtsEngine {
  readonly available: boolean
  speak(text: string, rate: number): Promise<void>
  stop(): void
}

interface SayModule {
  speak(
    text: string,
    voice: string | null,
    speed: number,
    callback: (err: Error | null) => void
  ): void
  stop(): void
}

/** Voz nativa (SAPI no Windows, `say` no macOS) via pacote `say`. */
class NativeTts implements TtsEngine {
  private say: SayModule | null = null
  private cancelled = false

  get available(): boolean {
    return process.platform === 'win32' || process.platform === 'darwin'
  }

  private load(): SayModule | null {
    if (!this.available) return null
    if (!this.say) {
      try {
        // require tardio: o pacote inspeciona a plataforma ao carregar
        this.say = require('say') as SayModule
      } catch (error) {
        console.error('[tts] pacote "say" indisponivel:', error)
        return null
      }
    }
    return this.say
  }

  speak(text: string, rate: number): Promise<void> {
    const say = this.load()
    if (!say) return Promise.resolve()
    this.cancelled = false
    return new Promise((resolve, reject) => {
      say.speak(text, null, rate, (err) => {
        if (this.cancelled) return resolve()
        if (err) return reject(err)
        resolve()
      })
    })
  }

  stop(): void {
    this.cancelled = true
    try {
      this.load()?.stop()
    } catch {
      /* stop sem fala em andamento e inofensivo */
    }
  }
}

/** Usada quando nao ha voz na plataforma; o briefing vira so texto na tela. */
class SilentTts implements TtsEngine {
  readonly available = false
  async speak(): Promise<void> {}
  stop(): void {}
}

export function createTtsEngine(): TtsEngine {
  const native = new NativeTts()
  return native.available ? native : new SilentTts()
}
