import test from 'node:test'
import assert from 'node:assert/strict'
import { createDatabase, setDatabase, closeDatabase } from '../src/main/db/index.ts'
import * as tasks from '../src/main/db/repositories/tasks.ts'
import * as categories from '../src/main/db/repositories/categories.ts'
import * as history from '../src/main/db/repositories/history.ts'
import { getSettings, updateSettings } from '../src/main/db/repositories/settings.ts'

/** Banco limpo em memoria para cada bloco de asserts. */
function fresh(): void {
  closeDatabase()
  setDatabase(createDatabase(':memory:'))
}

test('migracoes rodam e as categorias de estreia entram', () => {
  fresh()
  const list = categories.listCategories()
  assert.equal(list.length, 4)
  assert.ok(list.some((category) => category.name === 'Loja'))
  assert.match(list[0].color, /^#[0-9A-Fa-f]{6}$/)
})

test('migracao e idempotente', () => {
  fresh()
  const db = createDatabase(':memory:')
  const applied = db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get() as { n: number }
  assert.equal(applied.n, 1)
  db.close()
})

test('cria tarefa com lembrete diario e calcula o proximo disparo', () => {
  fresh()
  const loja = categories.findOrCreateByName('Loja')
  const task = tasks.createTask({
    title: 'Fechar caixa',
    category_id: loja.id,
    priority: 'alta',
    reminder: { recurrence_type: 'daily', recurrence_value: '19:00' }
  })

  assert.equal(task.title, 'Fechar caixa')
  assert.equal(task.category?.name, 'Loja')
  assert.equal(task.reminder?.recurrence_type, 'daily')
  assert.ok(task.reminder?.next_trigger_at)
  assert.ok(new Date(task.reminder!.next_trigger_at!) > new Date())
  assert.equal(history.listForTask(task.id)[0].action, 'created')
})

test('concluir tarefa recorrente reagenda o proximo aviso', () => {
  fresh()
  const task = tasks.createTask({
    title: 'Beber agua',
    reminder: { recurrence_type: 'minutes', recurrence_value: '30' }
  })
  const done = tasks.completeTask(task.id)

  assert.equal(done?.status, 'concluida')
  assert.ok(done?.completed_at)
  assert.ok(new Date(done!.reminder!.next_trigger_at!) > new Date())
  assert.ok(history.listForTask(task.id).some((entry) => entry.action === 'completed'))
})

test('adiar move o disparo e marca o historico', () => {
  fresh()
  const task = tasks.createTask({
    title: 'Responder email',
    due_at: new Date(Date.now() - 60_000).toISOString(),
    reminder: { recurrence_type: 'once' }
  })
  const snoozed = tasks.snoozeTask(task.id, 10)

  assert.equal(snoozed?.status, 'adiada')
  const next = new Date(snoozed!.reminder!.next_trigger_at!).getTime()
  assert.ok(next > Date.now() + 9 * 60_000 && next <= Date.now() + 10 * 60_000)
  assert.equal(history.listForTask(task.id)[0].action, 'snoozed')
})

test('dueReminders so devolve o que ja venceu e nao foi concluido', () => {
  fresh()
  const vencido = tasks.createTask({
    title: 'Vencido',
    reminder: {
      recurrence_type: 'once',
      next_trigger_at: new Date(Date.now() - 5_000).toISOString()
    }
  })
  tasks.createTask({
    title: 'Futuro',
    reminder: {
      recurrence_type: 'once',
      next_trigger_at: new Date(Date.now() + 3_600_000).toISOString()
    }
  })
  const concluido = tasks.createTask({
    title: 'Ja feito',
    reminder: {
      recurrence_type: 'once',
      next_trigger_at: new Date(Date.now() - 5_000).toISOString()
    }
  })
  tasks.completeTask(concluido.id)

  const due = tasks.dueReminders()
  assert.equal(due.length, 1)
  assert.equal(due[0].task.id, vencido.id)
})

test('busca e filtro por janela de datas', () => {
  fresh()
  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)
  const proximaSemana = new Date(hoje.getTime() + 7 * 86_400_000)

  tasks.createTask({ title: 'Revisar contrato', due_at: hoje.toISOString() })
  tasks.createTask({ title: 'Planejar viagem', due_at: proximaSemana.toISOString() })
  tasks.createTask({ title: 'Sem data marcada' })

  assert.equal(tasks.listTasks({ search: 'contrato' }).length, 1)
  assert.equal(tasks.listTasks({ search: 'CONTRATO' }).length, 1)

  const doDia = tasks.listTasks({
    from: new Date(hoje.getTime() - 3_600_000).toISOString(),
    to: new Date(hoje.getTime() + 3_600_000).toISOString()
  })
  assert.equal(doDia.length, 1)
  assert.equal(doDia[0].title, 'Revisar contrato')

  const comSemData = tasks.listTasks({
    from: new Date(hoje.getTime() - 3_600_000).toISOString(),
    to: new Date(hoje.getTime() + 3_600_000).toISOString(),
    includeUndated: true
  })
  assert.equal(comSemData.length, 2)
})

test('reagendar registra origem e destino no historico', () => {
  fresh()
  const original = new Date(Date.now() + 3_600_000).toISOString()
  const task = tasks.createTask({ title: 'Dentista', due_at: original })
  const destino = new Date(Date.now() + 2 * 86_400_000).toISOString()
  tasks.rescheduleTask(task.id, destino)

  const entry = history.listForTask(task.id).find((item) => item.action === 'rescheduled')
  assert.ok(entry)
  assert.deepEqual(JSON.parse(entry!.meta!), { from: original, to: destino })
  assert.equal(tasks.getTask(task.id)?.due_at, destino)
})

test('excluir categoria mantem a tarefa, sem agenda', () => {
  fresh()
  const category = categories.findOrCreateByName('Temporaria')
  const task = tasks.createTask({ title: 'Orfa', category_id: category.id })
  categories.deleteCategory(category.id)

  const reloaded = tasks.getTask(task.id)
  assert.equal(reloaded?.category_id, null)
  assert.equal(reloaded?.category, null)
})

test('excluir tarefa leva lembrete e historico junto', () => {
  fresh()
  const task = tasks.createTask({
    title: 'Descartavel',
    reminder: { recurrence_type: 'daily', recurrence_value: '08:00' }
  })
  tasks.deleteTask(task.id)

  assert.equal(tasks.getTask(task.id), null)
  assert.equal(history.listForTask(task.id).length, 0)
})

test('configuracoes ganham merge com os padroes', () => {
  fresh()
  assert.equal(getSettings().snoozeMinutes, 10)
  const updated = updateSettings({ snoozeMinutes: 25, news: { ...getSettings().news, rate: 1.5 } })
  assert.equal(updated.snoozeMinutes, 25)
  assert.equal(updated.news.rate, 1.5)
  assert.equal(updated.news.enabled, true)
  assert.equal(getSettings().globalHotkey, 'CommandOrControl+Alt+Space')
})

test('estatisticas contam conclusoes e adiamentos', () => {
  fresh()
  const a = tasks.createTask({ title: 'A' })
  const b = tasks.createTask({ title: 'B' })
  tasks.completeTask(a.id)
  tasks.snoozeTask(b.id, 10)
  tasks.snoozeTask(b.id, 10)

  const stats = history.stats()
  assert.equal(stats.completed7d, 1)
  assert.equal(stats.snoozed7d, 2)
  assert.equal(stats.topSnoozedTasks[0].title, 'B')
  assert.equal(stats.topSnoozedTasks[0].snoozes, 2)
})

test('contagem de pendentes ignora concluidas', () => {
  fresh()
  const a = tasks.createTask({ title: 'A' })
  tasks.createTask({ title: 'B' })
  tasks.completeTask(a.id)
  assert.equal(tasks.countPending(), 1)
  closeDatabase()
})
