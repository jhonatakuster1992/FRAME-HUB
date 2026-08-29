import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { PushSettings } from '../src/shared/types.ts'
import { createDatabase, setDatabase, closeDatabase } from '../src/main/db/index.ts'
import * as tasks from '../src/main/db/repositories/tasks.ts'
import { configureStorage, saveBytes } from '../src/main/attachments.ts'
import { enviarLembrete, enviarTeste } from '../src/main/push.ts'

interface Recebido {
  method: string
  url: string
  headers: IncomingMessage['headers']
  body: Buffer
}

/** Servidor de mentira no lugar do ntfy, para ver o que sai de verdade. */
async function servidorFalso(
  responder: (recebido: Recebido) => { status: number; body?: string } = () => ({ status: 200 })
): Promise<{ base: string; recebidos: Recebido[]; fechar: () => Promise<void>; server: Server }> {
  const recebidos: Recebido[] = []
  const server = createServer((req, res) => {
    const pedacos: Buffer[] = []
    req.on('data', (pedaco: Buffer) => pedacos.push(pedaco))
    req.on('end', () => {
      const recebido = {
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(pedacos)
      }
      recebidos.push(recebido)
      const resposta = responder(recebido)
      res.writeHead(resposta.status)
      res.end(resposta.body ?? 'ok')
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const porta = (server.address() as { port: number }).port
  return {
    base: `http://127.0.0.1:${porta}`,
    recebidos,
    server,
    fechar: () => new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

function ambiente(base: string, patch: Partial<PushSettings> = {}): PushSettings {
  closeDatabase()
  setDatabase(createDatabase(':memory:'))
  configureStorage(mkdtempSync(join(tmpdir(), 'push-teste-')))
  return {
    enabled: true,
    server: base,
    topic: 'tasker-teste',
    token: null,
    includeImage: true,
    onlyIdleMinutes: 0,
    ...patch
  }
}

test('sem anexo, envia JSON com o tópico no corpo', async () => {
  const falso = await servidorFalso()
  const config = ambiente(falso.base)
  const tarefa = tasks.createTask({ title: 'Ligar pro contador', description: 'Antes das 18h' })

  const status = await enviarLembrete(config, tarefa)
  await falso.fechar()

  assert.equal(status.ok, true)
  const [pedido] = falso.recebidos
  assert.equal(pedido.method, 'POST')
  assert.equal(pedido.url, '/')
  assert.match(String(pedido.headers['content-type']), /application\/json/)

  const corpo = JSON.parse(pedido.body.toString('utf-8'))
  assert.equal(corpo.topic, 'tasker-teste')
  assert.equal(corpo.title, 'Ligar pro contador')
  assert.match(corpo.message, /Antes das 18h/)
  assert.equal(corpo.priority, 4)
})

test('com print anexado, envia os bytes por PUT e o texto na query', async () => {
  const falso = await servidorFalso()
  const config = ambiente(falso.base)
  const tarefa = tasks.createTask({ title: 'Revisão do contrato' })
  saveBytes(tarefa.id, {
    original_name: 'print.png',
    mime: 'image/png',
    bytes: Buffer.from('bytes-do-print')
  })

  const status = await enviarLembrete(config, tasks.getTask(tarefa.id)!)
  await falso.fechar()

  assert.equal(status.ok, true)
  const [pedido] = falso.recebidos
  assert.equal(pedido.method, 'PUT')
  assert.equal(pedido.body.toString('utf-8'), 'bytes-do-print')

  const url = new URL(pedido.url, 'http://x')
  assert.equal(url.pathname, '/tasker-teste')
  assert.equal(url.searchParams.get('title'), 'Revisão do contrato')
  assert.equal(url.searchParams.get('filename'), 'print.png')
})

test('sem "mandar o print", volta para o envio em JSON', async () => {
  const falso = await servidorFalso()
  const config = ambiente(falso.base, { includeImage: false })
  const tarefa = tasks.createTask({ title: 'Só texto' })
  saveBytes(tarefa.id, { original_name: 'p.png', mime: 'image/png', bytes: Buffer.from('x') })

  await enviarLembrete(config, tasks.getTask(tarefa.id)!)
  await falso.fechar()

  assert.equal(falso.recebidos[0].method, 'POST')
})

test('token vira cabeçalho Authorization', async () => {
  const falso = await servidorFalso()
  const config = ambiente(falso.base, { token: 'tk_segredo' })

  await enviarTeste(config)
  await falso.fechar()

  assert.equal(falso.recebidos[0].headers.authorization, 'Bearer tk_segredo')
})

test('erro do servidor não estoura — vira status de falha', async () => {
  const falso = await servidorFalso(() => ({ status: 403, body: 'forbidden' }))
  const config = ambiente(falso.base)

  const status = await enviarTeste(config)
  await falso.fechar()

  assert.equal(status.ok, false)
  assert.match(status.error ?? '', /403/)
})

test('servidor fora do ar não derruba o disparo local', async () => {
  // porta fechada de propósito
  const config = ambiente('http://127.0.0.1:1')
  const status = await enviarTeste(config)

  assert.equal(status.ok, false)
  assert.ok(status.error)
  closeDatabase()
})
