import { useState } from 'react'
import type { Category } from '@shared/types'
import { api } from '../../shared/api'
import { Icon } from '../../shared/Icon'

interface Props {
  categories: Category[]
  hidden: Set<number>
  counts: Map<number, number>
  onToggle: (id: number) => void
}

const PALETTE = ['#7C3AED', '#F59E0B', '#10B981', '#F43F5E', '#0EA5E9', '#EC4899']

/** Agendas como pilulas — ligar/desligar filtra calendario e lista. */
export function CategoryChips({
  categories,
  hidden,
  counts,
  onToggle
}: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[categories.length % PALETTE.length])

  const add = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setName('')
    setColor(PALETTE[(categories.length + 1) % PALETTE.length])
    await api.categories.create({ name: trimmed, color })
  }

  return (
    <div className="chips">
      <span className="chips__label">Agendas:</span>

      {categories.map((category) => {
        const on = !hidden.has(category.id)
        return (
          <button
            key={category.id}
            className={`chip-toggle${on ? ' chip-toggle--on' : ''}`}
            onClick={() => onToggle(category.id)}
            title={on ? 'Ocultar desta visão' : 'Mostrar nesta visão'}
          >
            <i className="dot" style={{ background: on ? '#fff' : category.color }} />
            {category.name}
            <span className="chip-toggle__count">{counts.get(category.id) ?? 0}</span>
          </button>
        )
      })}

      <form className="chip-add" onSubmit={add}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nova agenda"
          aria-label="Nome da nova agenda"
        />
        <input
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          aria-label="Cor da agenda"
        />
        <button className="icon-btn" style={{ width: 28, height: 28 }} type="submit" aria-label="Criar agenda">
          <Icon name="mais" className="icon icon--sm" />
        </button>
      </form>
    </div>
  )
}
