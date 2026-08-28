import { useState } from 'react'
import type { Category } from '@shared/types'
import { api } from '../../shared/api'
import { Icon } from '../../shared/Icon'

interface Props {
  categories: Category[]
  selected: number | null
  total: number
  counts: Map<number, number>
  onSelect: (id: number | null) => void
  allowCreate?: boolean
}

const PALETTE = ['#4A21C7', '#FF7A29', '#22C55E', '#EC4899', '#3B82F6', '#14B8A6']

/** Linha de sugestões: filtra por agenda, uma de cada vez. */
export function CategoryChips({
  categories,
  selected,
  total,
  counts,
  onSelect,
  allowCreate = false
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
      <span className="chips__label">Sugestões:</span>

      <button
        className={`chip-toggle${selected === null ? ' chip-toggle--on' : ''}`}
        onClick={() => onSelect(null)}
      >
        Todas
        <span className="chip-toggle__count">{total}</span>
      </button>

      {categories.map((category) => {
        const on = selected === category.id
        return (
          <button
            key={category.id}
            className={`chip-toggle${on ? ' chip-toggle--on' : ''}`}
            onClick={() => onSelect(on ? null : category.id)}
          >
            <i className="dot" style={{ background: on ? '#fff' : category.color }} />
            {category.name}
            <span className="chip-toggle__count">{counts.get(category.id) ?? 0}</span>
          </button>
        )
      })}

      {allowCreate && (
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
        <button type="submit" aria-label="Criar agenda">
          <Icon name="mais" className="icon icon--sm" />
        </button>
      </form>
      )}
    </div>
  )
}
