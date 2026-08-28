import type { CSSProperties, ReactNode } from 'react'

/**
 * O "card-nota": mesmo componente no post-it, na lista e no calendario.
 * A barra colorida no topo e a aba do post-it (cor = categoria).
 */
export interface NoteCardProps {
  color?: string | null
  done?: boolean
  interactive?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
  onClick?: () => void
  onDoubleClick?: () => void
  draggable?: boolean
  onDragStart?: (event: React.DragEvent) => void
  title?: string
}

export function NoteCard({
  color,
  done,
  interactive = true,
  className = '',
  style,
  children,
  ...rest
}: NoteCardProps): React.JSX.Element {
  return (
    <div
      className={[
        'note-card',
        interactive ? 'note-card--interactive' : '',
        done ? 'note-card--done' : '',
        className
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ ...style, ['--note-color' as string]: color ?? 'var(--accent)' }}
      {...rest}
    >
      {children}
    </div>
  )
}
