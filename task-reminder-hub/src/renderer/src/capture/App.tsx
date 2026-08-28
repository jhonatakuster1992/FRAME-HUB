import { useEffect, useMemo, useRef, useState } from 'react'
import { parseQuickCapture } from '@shared/quick-parse'
import { describeRecurrence } from '@shared/recurrence'
import { api } from '../shared/api'
import { useEscape, useSettings, useTheme } from '../shared/hooks'
import { fmtRelative } from '../shared/date'

/**
 * Caixa da hotkey: digita, Enter, some. O preview mostra o que o parser
 * entendeu antes de gravar, para o atalho nunca virar caixa-preta.
 */
export function App(): React.JSX.Element {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [settings] = useSettings()
  useTheme(settings?.theme)

  const parsed = useMemo(() => (text.trim() ? parseQuickCapture(text) : null), [text])

  const reset = (): void => {
    setText('')
    setError(null)
    inputRef.current?.focus()
  }

  // A janela e reaproveitada (hide/show), entao limpa a cada reabertura.
  useEffect(() => {
    const onFocus = (): void => reset()
    window.addEventListener('focus', onFocus)
    inputRef.current?.focus()
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  useEscape(() => {
    setText('')
    void api.window.hideCapture()
  })

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (!text.trim() || saving) return
    setSaving(true)
    try {
      await api.tasks.quickCapture(text)
      setText('')
      void api.window.hideCapture()
    } catch (err) {
      setError((err as Error).message.replace(/^Error invoking remote method '[^']+': /, ''))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="capture" onSubmit={submit}>
      <div className="capture__bar" />
      <input
        ref={inputRef}
        className="capture__input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="O que precisa acontecer?"
        aria-label="Captura rápida"
        autoFocus
      />
      <div className="capture__foot">
        <div className="capture__preview">
          {error && <span className="capture__warn">{error}</span>}

          {!error && parsed && (
            <>
              {parsed.categoryName && <span className="chip">#{parsed.categoryName}</span>}
              {parsed.priority && <span className="chip">prioridade {parsed.priority}</span>}
              {parsed.dueAt && (
                <span className="chip">{fmtRelative(parsed.dueAt.toISOString())}</span>
              )}
              {parsed.recurrence && (
                <span className="chip">
                  {describeRecurrence({
                    type: parsed.recurrence.type,
                    value: parsed.recurrence.value
                  })}
                </span>
              )}
              {parsed.warnings.map((warning) => (
                <span key={warning} className="capture__warn">
                  {warning}
                </span>
              ))}
            </>
          )}

          {!error && !parsed && (
            <span>#categoria · !alta · @amanha 09:00 · *30m · *diario 08:00</span>
          )}
        </div>
        <span className="capture__kbd">Enter salva</span>
        <span className="capture__kbd">Esc fecha</span>
      </div>
    </form>
  )
}
