import test from 'node:test'
import assert from 'node:assert/strict'
import { parseQuickCapture } from '../src/shared/quick-parse.ts'

const now = new Date('2026-03-10T10:00:00') // terca-feira

test('titulo puro vira so titulo', () => {
  const parsed = parseQuickCapture('Comprar cafe', now)
  assert.equal(parsed.title, 'Comprar cafe')
  assert.equal(parsed.categoryName, null)
  assert.equal(parsed.dueAt, null)
})

test('categoria, prioridade e data juntas', () => {
  const parsed = parseQuickCapture('Ligar pro contador #Loja !alta @amanha 09:00', now)
  assert.equal(parsed.title, 'Ligar pro contador')
  assert.equal(parsed.categoryName, 'Loja')
  assert.equal(parsed.priority, 'alta')
  assert.equal(parsed.dueAt?.getDate(), 11)
  assert.equal(parsed.dueAt?.getHours(), 9)
})

test('hora sem data que ja passou cai para amanha', () => {
  const parsed = parseQuickCapture('Reuniao @08:00', now)
  assert.equal(parsed.dueAt?.getDate(), 11)
})

test('hora sem data ainda por vir fica hoje', () => {
  const parsed = parseQuickCapture('Reuniao @18:30', now)
  assert.equal(parsed.dueAt?.getDate(), 10)
  assert.equal(parsed.dueAt?.getMinutes(), 30)
})

test('dia da semana aponta para a proxima ocorrencia', () => {
  const parsed = parseQuickCapture('Feira @sab 07:00', now)
  assert.equal(parsed.dueAt?.getDay(), 6)
  assert.equal(parsed.dueAt?.getDate(), 14)
})

test('data explicita dd/mm', () => {
  const parsed = parseQuickCapture('Pagar boleto @25/12 08:00', now)
  assert.equal(parsed.dueAt?.getMonth(), 11)
  assert.equal(parsed.dueAt?.getDate(), 25)
})

test('recorrencias curtas', () => {
  assert.deepEqual(parseQuickCapture('Beber agua *30m', now).recurrence, {
    type: 'minutes',
    value: '30'
  })
  assert.deepEqual(parseQuickCapture('Alongar *2h', now).recurrence, {
    type: 'hourly',
    value: '2'
  })
})

test('recorrencia diaria, semanal e mensal', () => {
  assert.deepEqual(parseQuickCapture('Fechar caixa *diario 19:00', now).recurrence, {
    type: 'daily',
    value: '19:00'
  })
  assert.deepEqual(parseQuickCapture('Treino *semanal seg,qua,sex 07:00', now).recurrence, {
    type: 'weekly',
    value: '1,3,5@07:00'
  })
  assert.deepEqual(parseQuickCapture('Aluguel *mensal 5 09:00', now).recurrence, {
    type: 'monthly',
    value: '5@09:00'
  })
})

test('token nao reconhecido volta para o titulo com aviso', () => {
  const parsed = parseQuickCapture('Ver serie @qualquercoisa', now)
  assert.match(parsed.title, /@qualquercoisa/)
  assert.equal(parsed.warnings.length, 1)
})

test('texto depois da categoria continua no titulo', () => {
  const parsed = parseQuickCapture('#Loja repor estoque de filtro', now)
  assert.equal(parsed.categoryName, 'Loja')
  assert.equal(parsed.title, 'repor estoque de filtro')
})
