import { useCallback, useEffect, useState } from 'react'
import type { Attachment, AttachmentInput } from '@shared/types'
import { api } from '../../shared/api'
import { Icon, type IconName } from '../../shared/Icon'

interface Props {
  /** Null enquanto a tarefa ainda não existe: os arquivos ficam em espera. */
  taskId: number | null
  pending: AttachmentInput[]
  onPending: (files: AttachmentInput[]) => void
  onChanged?: () => void
}

const ICONE: Record<Attachment['kind'], IconName> = {
  imagem: 'imagem',
  audio: 'som',
  arquivo: 'arquivo'
}

const tamanho = (bytes: number): string =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

/** File → base64 puro (sem o prefixo data:), que é o que o IPC transporta. */
function paraBase64(file: File): Promise<AttachmentInput> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onerror = () => reject(new Error(`Não consegui ler ${file.name}`))
    leitor.onload = () =>
      resolve({
        original_name: file.name || 'anexo',
        mime: file.type,
        data: String(leitor.result).split(',')[1] ?? ''
      })
    leitor.readAsDataURL(file)
  })
}

/**
 * Anexos da tarefa: colar print (Ctrl+V), arrastar arquivo ou escolher no
 * disco. Prévias vêm como data URL porque o CSP não deixa carregar file://.
 */
export function Attachments({ taskId, pending, onPending, onChanged }: Props): React.JSX.Element {
  const [salvos, setSalvos] = useState<Attachment[]>([])
  const [previas, setPrevias] = useState<Record<number, string>>({})
  const [arrastando, setArrastando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(() => {
    if (taskId === null) return
    void api.attachments.list(taskId).then(setSalvos)
  }, [taskId])

  useEffect(recarregar, [recarregar])

  // Carrega as prévias uma vez por anexo; imagem e áudio precisam dos bytes.
  useEffect(() => {
    for (const anexo of salvos) {
      if (anexo.kind === 'arquivo' || previas[anexo.id]) continue
      void api.attachments.data(anexo.id).then((url) => {
        if (url) setPrevias((atual) => ({ ...atual, [anexo.id]: url }))
      })
    }
  }, [salvos, previas])

  const receber = async (files: File[]): Promise<void> => {
    if (files.length === 0) return
    setErro(null)
    try {
      const entradas = await Promise.all(files.map(paraBase64))
      if (taskId === null) {
        onPending([...pending, ...entradas])
        return
      }
      await api.attachments.add(taskId, entradas)
      recarregar()
      onChanged?.()
    } catch (falha) {
      setErro((falha as Error).message)
    }
  }

  const escolher = async (): Promise<void> => {
    if (taskId === null) {
      setErro('Salve a tarefa primeiro para escolher arquivos do disco.')
      return
    }
    await api.attachments.pick(taskId)
    recarregar()
    onChanged?.()
  }

  const remover = async (id: number): Promise<void> => {
    await api.attachments.remove(id)
    recarregar()
    onChanged?.()
  }

  const total = salvos.length + pending.length

  return (
    <div>
      <span className="label">
        Anexos {total > 0 && <span style={{ color: 'var(--accent-text)' }}>({total})</span>}
      </span>

      <div
        className={`anexos__area${arrastando ? ' anexos__area--sobre' : ''}`}
        onDragOver={(evento) => {
          evento.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(evento) => {
          evento.preventDefault()
          setArrastando(false)
          void receber([...evento.dataTransfer.files])
        }}
        onPaste={(evento) => {
          const arquivos = [...evento.clipboardData.files]
          if (arquivos.length > 0) {
            evento.preventDefault()
            void receber(arquivos)
          }
        }}
        tabIndex={0}
      >
        {total === 0 ? (
          <p className="anexos__vazio">
            <Icon name="clipe" />
            Cole um print com <kbd>Ctrl+V</kbd>, arraste um arquivo aqui
            <br />
            ou <button type="button" className="anexos__link" onClick={() => void escolher()}>
              escolha no disco
            </button>
          </p>
        ) : (
          <div className="anexos__lista">
            {salvos.map((anexo) => (
              <div key={anexo.id} className="anexo">
                {anexo.kind === 'imagem' && previas[anexo.id] ? (
                  <img
                    className="anexo__miniatura"
                    src={previas[anexo.id]}
                    alt={anexo.original_name}
                    onClick={() => void api.attachments.open(anexo.id)}
                  />
                ) : (
                  <span className="anexo__icone" onClick={() => void api.attachments.open(anexo.id)}>
                    <Icon name={ICONE[anexo.kind]} />
                  </span>
                )}

                <div className="anexo__info">
                  <span className="anexo__nome" title={anexo.original_name}>
                    {anexo.original_name}
                  </span>
                  <span className="anexo__tamanho">{tamanho(anexo.size_bytes)}</span>
                  {anexo.kind === 'audio' && previas[anexo.id] && (
                    <audio className="anexo__audio" controls preload="none" src={previas[anexo.id]} />
                  )}
                </div>

                <button
                  type="button"
                  className="anexo__remover"
                  onClick={() => void remover(anexo.id)}
                  aria-label={`Remover ${anexo.original_name}`}
                >
                  <Icon name="lixo" className="icon icon--sm" />
                </button>
              </div>
            ))}

            {pending.map((arquivo, indice) => (
              <div key={`pendente-${indice}`} className="anexo anexo--pendente">
                <span className="anexo__icone">
                  <Icon name={arquivo.mime.startsWith('image/') ? 'imagem' : 'arquivo'} />
                </span>
                <div className="anexo__info">
                  <span className="anexo__nome">{arquivo.original_name}</span>
                  <span className="anexo__tamanho">anexa ao salvar</span>
                </div>
                <button
                  type="button"
                  className="anexo__remover"
                  onClick={() => onPending(pending.filter((_, i) => i !== indice))}
                  aria-label="Descartar"
                >
                  <Icon name="fechar" className="icon icon--sm" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="anexos__acoes">
        <button type="button" className="btn btn--sm" onClick={() => void escolher()}>
          <Icon name="clipe" className="icon icon--sm" /> Escolher arquivo
        </button>
        {erro && <span className="anexos__erro">{erro}</span>}
      </div>
    </div>
  )
}
