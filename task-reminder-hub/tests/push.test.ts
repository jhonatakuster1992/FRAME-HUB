import test from 'node:test'
import assert from 'node:assert/strict'
import type { PushSettings, TaskWithMeta } from '../src/shared/types.ts'
import {
  PushError,
  TOPICO_VALIDO,
  montarDestino,
  montarMensagem,
  novoTopico,
  urlComAnexo
} from '../src/main/push.ts'

const config = (patch: Partial<PushSettings> = {}): PushSettings => ({
  enabled: true,
  server: 'https://ntfy.sh',
  topic: 'tasker-abc123',
  token: null,
  includeImage: true,
  onlyIdleMinutes: 0,
  ...patch
})

const tarefa = (patch: Partial<TaskWithMeta> = {}): TaskWithMeta => ({
  id: 1,
  title: 'Fechar o caixa',
  description: null,
  category_id: null,
  priority: 'media',
  status: 'pendente',
  due_at: null,
  duration_minutes: 30,
  created_at: '2026-08-28T12:00:00.000Z',
  updated_at: '2026-08-28T12:00:00.000Z',
  completed_at: null,
  category: null,
  reminder: null,
  attachments: 0,
  ...patch
})

test('o tópico sorteado é longo e válido para o ntfy', () => {
  const topicos = new Set(Array.from({ length: 50 }, () => novoTopico()))
  assert.equal(topicos.size, 50, 'sorteou repetido')
  for (const topico of topicos) {
    assert.match(topico, TOPICO_VALIDO)
    assert.ok(topico.length >= 16, `curto demais: ${topico}`)
  }
})

test('a mensagem junta descrição, agenda e recorrência', () => {
  const mensagem = montarMensagem(
    tarefa({
      title: 'Fechar o caixa',
      description: 'Conferir o print do fornecedor',
      category: { id: 2, name: 'Loja', color: '#FF7A29', visible: true, created_at: '' },
      reminder: {
        id: 1,
        task_id: 1,
        recurrence_type: 'daily',
        recurrence_value: '19:00',
        next_trigger_at: null,
        last_triggered_at: null,
        enabled: true
      }
    })
  )

  assert.equal(mensagem.title, 'Fechar o caixa')
  assert.match(mensagem.message, /Conferir o print do fornecedor/)
  assert.match(mensagem.message, /Agenda: Loja/)
  assert.match(mensagem.message, /Todo dia as 19:00/)
  // prioridade alta acorda a tela do celular e chega no relógio
  assert.equal(mensagem.priority, 4)
})

test('tarefa sem detalhe nenhum ainda gera texto', () => {
  assert.equal(montarMensagem(tarefa()).message, 'Lembrete')
})

test('destino normaliza a barra final e valida o servidor', () => {
  assert.deepEqual(montarDestino(config({ server: 'https://ntfy.sh/' })), {
    base: 'https://ntfy.sh',
    topic: 'tasker-abc123'
  })
  assert.throws(() => montarDestino(config({ server: 'ntfy.sh' })), PushError)
})

test('tópico fora da regra do ntfy é recusado antes de sair da máquina', () => {
  assert.throws(() => montarDestino(config({ topic: '' })), PushError)
  assert.throws(() => montarDestino(config({ topic: 'com espaço' })), PushError)
  assert.throws(() => montarDestino(config({ topic: 'barra/dentro' })), PushError)
  assert.doesNotThrow(() => montarDestino(config({ topic: 'a_b-C9' })))
})

test('envio com anexo leva título acentuado em query param', () => {
  const url = new URL(
    urlComAnexo(
      { base: 'https://ntfy.sh', topic: 'tasker-abc123' },
      { title: 'Revisão do contrato', message: 'Agenda: Ações', priority: 4, tags: ['bell'] },
      'print da conversa.png'
    )
  )

  assert.equal(url.pathname, '/tasker-abc123')
  // o URLSearchParams decodifica de volta: acento sobrevive à viagem
  assert.equal(url.searchParams.get('title'), 'Revisão do contrato')
  assert.equal(url.searchParams.get('message'), 'Agenda: Ações')
  assert.equal(url.searchParams.get('filename'), 'print da conversa.png')
  assert.equal(url.searchParams.get('priority'), '4')
})
