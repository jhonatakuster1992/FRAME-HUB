import test from 'node:test'
import assert from 'node:assert/strict'
import {
  catchUp,
  computeNextTrigger,
  describeRecurrence,
  validateRecurrence,
  RecurrenceError
} from '../src/shared/recurrence.ts'

const at = (iso: string): Date => new Date(iso)

test('once nao tem proximo disparo', () => {
  assert.equal(computeNextTrigger({ type: 'once', value: null }, at('2026-03-10T08:00:00')), null)
})

test('intervalo em minutos e horas soma a partir de agora', () => {
  const from = at('2026-03-10T08:00:00')
  assert.equal(
    computeNextTrigger({ type: 'minutes', value: '30' }, from)?.toISOString(),
    at('2026-03-10T08:30:00').toISOString()
  )
  assert.equal(
    computeNextTrigger({ type: 'hourly', value: '2' }, from)?.toISOString(),
    at('2026-03-10T10:00:00').toISOString()
  )
})

test('diario pula para o dia seguinte quando o horario ja passou', () => {
  const next = computeNextTrigger({ type: 'daily', value: '08:00' }, at('2026-03-10T09:15:00'))
  assert.equal(next?.getDate(), 11)
  assert.equal(next?.getHours(), 8)
})

test('diario ainda cabe hoje quando o horario esta a frente', () => {
  const next = computeNextTrigger({ type: 'daily', value: '18:00' }, at('2026-03-10T09:15:00'))
  assert.equal(next?.getDate(), 10)
  assert.equal(next?.getHours(), 18)
})

test('horarios fixos pegam o proximo do dia e viram para amanha no fim', () => {
  const spec = { type: 'custom_times' as const, value: '08:00,12:30,18:00' }
  const meio = computeNextTrigger(spec, at('2026-03-10T09:00:00'))
  assert.equal(meio?.getHours(), 12)
  assert.equal(meio?.getMinutes(), 30)

  const virada = computeNextTrigger(spec, at('2026-03-10T20:00:00'))
  assert.equal(virada?.getDate(), 11)
  assert.equal(virada?.getHours(), 8)
})

test('semanal acha o proximo dia da lista', () => {
  // 2026-03-10 e uma terca-feira
  const next = computeNextTrigger({ type: 'weekly', value: '1,3,5@09:00' }, at('2026-03-10T10:00:00'))
  assert.equal(next?.getDay(), 3) // quarta
  assert.equal(next?.getDate(), 11)
})

test('semanal no mesmo dia respeita o horario ainda por vir', () => {
  const next = computeNextTrigger({ type: 'weekly', value: '2@23:00' }, at('2026-03-10T10:00:00'))
  assert.equal(next?.getDate(), 10)
  assert.equal(next?.getHours(), 23)
})

test('mensal dia 31 cai no ultimo dia valido do mes', () => {
  const next = computeNextTrigger({ type: 'monthly', value: '31@09:00' }, at('2026-02-01T10:00:00'))
  assert.equal(next?.getMonth(), 1) // fevereiro
  assert.equal(next?.getDate(), 28)
})

test('mensal pula para o mes seguinte quando a data ja passou', () => {
  const next = computeNextTrigger({ type: 'monthly', value: '5@09:00' }, at('2026-03-10T10:00:00'))
  assert.equal(next?.getMonth(), 3) // abril
  assert.equal(next?.getDate(), 5)
})

test('catchUp avanca sem repetir disparos atrasados', () => {
  const from = at('2026-03-10T08:00:00')
  const now = at('2026-03-10T12:07:00')
  const next = catchUp({ type: 'minutes', value: '15' }, from, now)
  assert.ok(next && next > now)
  assert.equal(next!.getHours(), 12)
  assert.equal(next!.getMinutes(), 15)
})

test('valores invalidos falham na validacao', () => {
  assert.throws(() => validateRecurrence({ type: 'minutes', value: '0' }), RecurrenceError)
  assert.throws(() => validateRecurrence({ type: 'daily', value: '25:00' }), RecurrenceError)
  assert.throws(() => validateRecurrence({ type: 'weekly', value: '9@09:00' }), RecurrenceError)
  assert.doesNotThrow(() => validateRecurrence({ type: 'once', value: null }))
})

test('descricao legivel para a UI', () => {
  assert.equal(describeRecurrence({ type: 'minutes', value: '30' }), 'A cada 30 min')
  assert.equal(describeRecurrence({ type: 'weekly', value: '1,5@08:30' }), 'seg, sex as 08:30')
  assert.equal(describeRecurrence({ type: 'monthly', value: '5@09:00' }), 'Dia 5 as 09:00')
  assert.equal(describeRecurrence({ type: 'daily', value: 'xx' }), 'Recorrencia invalida')
})
