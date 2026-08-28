import { Icon } from '../../shared/Icon'

export type PeriodFilter = 'todas' | 'hoje' | 'semana' | 'mes' | 'atrasadas'

const PERIODS: { id: PeriodFilter; label: string }[] = [
  { id: 'todas', label: 'Qualquer data' },
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Próximos 7 dias' },
  { id: 'mes', label: 'Este mês' },
  { id: 'atrasadas', label: 'Atrasadas' }
]

interface Props {
  period: PeriodFilter
  onPeriod: (period: PeriodFilter) => void
  search: string
  onSearch: (search: string) => void
  onClear: () => void
  onSubmit: () => void
}

/** Faixa branca de busca: período, palavra-chave e os dois botões. */
export function SearchPanel({
  period,
  onPeriod,
  search,
  onSearch,
  onClear,
  onSubmit
}: Props): React.JSX.Element {
  return (
    <form
      className="searchpanel"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label className="searchpanel__seg searchpanel__seg--select">
        <Icon name="agenda" className="icon icon--sm" />
        <select value={period} onChange={(event) => onPeriod(event.target.value as PeriodFilter)}>
          {PERIODS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <Icon name="baixo" className="icon icon--sm searchpanel__caret" />
      </label>

      <div className="searchpanel__seg searchpanel__seg--grow">
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Busque por título, descrição ou agenda…"
          aria-label="Buscar tarefas"
        />
      </div>

      <button type="button" className="btn btn--soft btn--caps" onClick={onClear}>
        <Icon name="filtro" className="icon icon--sm" />
        Limpar
      </button>
      <button type="submit" className="btn btn--primary btn--caps">
        <Icon name="busca" className="icon icon--sm" />
        Buscar
      </button>
    </form>
  )
}
