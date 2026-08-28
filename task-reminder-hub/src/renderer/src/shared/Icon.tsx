/**
 * Icones em traco (24x24) para a interface, e glifos solidos para a barra
 * lateral — que na referencia sao cheios, nao vazados. Tudo herda
 * currentColor, entao o mesmo icone serve no violeta e na aba branca.
 */
export type IconName = keyof typeof PATHS

const PATHS = {
  busca: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  sino: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  chat: 'M21 11.5a8.4 8.4 0 0 1-12.8 7.2L3 21l2.3-5.2A8.4 8.4 0 1 1 21 11.5z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  mais: 'M12 5v14M5 12h14',
  sol: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  lua: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  auto: 'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 21h8M12 17v4',
  esquerda: 'M15 18l-6-6 6-6',
  direita: 'M9 18l6-6-6-6',
  baixo: 'M6 9l6 6 6-6',
  check: 'M20 6L9 17l-5-5',
  relogio: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  lixo: 'M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  editar: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z',
  grade: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  linhas: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  fechar: 'M18 6L6 18M6 6l12 12',
  play: 'M7 4l13 8-13 8V4z',
  pause: 'M8 4h3v16H8zM14 4h3v16h-3z',
  proximo: 'M6 4l10 8-10 8V4zM19 5v14',
  anterior: 'M18 20L8 12l10-8v16zM5 5v14',
  recarregar: 'M22 4v6h-6M20 14a8 8 0 1 1-2-8.2L22 10',
  repetir: 'M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  filtro: 'M22 3H2l8 9.5V19l4 2v-8.5L22 3',
  externo: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3',
  agenda: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  janela: 'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM3 9h18',
  alerta: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  tarefas: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  clipe: 'M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.65 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.83l8.48-8.48',
  imagem: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  som: 'M11 5L6 9H2v6h4l5 4V5zM19.1 4.9a10 10 0 0 1 0 14.2M15.5 8.5a5 5 0 0 1 0 7',
  arquivo: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6'
} as const

interface Props {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
}

export function Icon({ name, size, className = 'icon', strokeWidth = 1.9 }: Props): React.JSX.Element {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

/* ── Glifos sólidos da barra lateral ─────────────────────── */

export type NavIconName = 'tarefas' | 'agenda' | 'briefing' | 'produtividade' | 'ajustes'

const SOLID: Record<NavIconName, React.JSX.Element> = {
  // quadrado cheio com o "tique" vazado (fura o preenchimento)
  tarefas: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6 2.5h12A3.5 3.5 0 0 1 21.5 6v12a3.5 3.5 0 0 1-3.5 3.5H6A3.5 3.5 0 0 1 2.5 18V6A3.5 3.5 0 0 1 6 2.5zm10.9 6.2a1.1 1.1 0 0 0-1.6 0l-4.7 4.8-2-2a1.1 1.1 0 1 0-1.6 1.6l2.8 2.8c.4.4 1.1.4 1.6 0l5.5-5.6c.4-.4.4-1.2 0-1.6z"
    />
  ),
  agenda: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.5 1.6c.6 0 1.1.5 1.1 1.1v1.1h6.8V2.7a1.1 1.1 0 1 1 2.2 0v1.1h.4a3.5 3.5 0 0 1 3.5 3.5v11.2a3.5 3.5 0 0 1-3.5 3.5H6a3.5 3.5 0 0 1-3.5-3.5V7.3A3.5 3.5 0 0 1 6 3.8h.4V2.7c0-.6.5-1.1 1.1-1.1zM4.7 10v8.5c0 .7.6 1.3 1.3 1.3h12c.7 0 1.3-.6 1.3-1.3V10H4.7z"
    />
  ),
  briefing: (
    <>
      <path d="M12.6 3.6c.7-.6 1.9-.1 1.9.9v15c0 1-1.2 1.5-1.9.9L8 16.6H5.4A2.4 2.4 0 0 1 3 14.2V9.8a2.4 2.4 0 0 1 2.4-2.4H8l4.6-3.8z" />
      <path
        d="M17.4 8.6a4.8 4.8 0 0 1 0 6.8M20.2 5.8a8.8 8.8 0 0 1 0 12.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
  produtividade: (
    <>
      <rect x="3" y="12" width="4.2" height="9" rx="2.1" />
      <rect x="9.9" y="3" width="4.2" height="18" rx="2.1" />
      <rect x="16.8" y="8" width="4.2" height="13" rx="2.1" />
    </>
  ),
  ajustes: (
    <>
      <path
        d="M4 7h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="9" cy="7" r="3.2" />
      <circle cx="16" cy="17" r="3.2" />
    </>
  )
}

export function NavIcon({ name, size = 22 }: { name: NavIconName; size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {SOLID[name]}
    </svg>
  )
}

/** Marca do app: quadrado arredondado com um tique vazado. */
export function BrandMark({ size = 40 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <rect width="44" height="44" rx="15" fill="var(--brand-mark-bg, #fff)" />
      <path
        d="M13 22.6l6 6L31 15.5"
        stroke="var(--brand-mark-ink, #4A21C7)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
