import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createDatabase, setDatabase, closeDatabase } from '../src/main/db/index.ts'
import * as tasks from '../src/main/db/repositories/tasks.ts'
import * as repo from '../src/main/db/repositories/attachments.ts'
import {
  configureStorage,
  filePath,
  kindFromMime,
  pruneOrphans,
  removeAttachment,
  removeForTask,
  saveBytes,
  saveFromPath,
  storageDir
} from '../src/main/attachments.ts'

function ambienteLimpo(): void {
  closeDatabase()
  setDatabase(createDatabase(':memory:'))
  configureStorage(mkdtempSync(join(tmpdir(), 'anexos-teste-')))
}

const bytes = (texto: string): Buffer => Buffer.from(texto, 'utf-8')

test('grava o arquivo em disco e a linha no banco', () => {
  ambienteLimpo()
  const tarefa = tasks.createTask({ title: 'Com print' })
  const anexo = saveBytes(tarefa.id, {
    original_name: 'print.png',
    mime: 'image/png',
    bytes: bytes('conteudo-falso')
  })

  assert.equal(anexo.kind, 'imagem')
  assert.equal(anexo.original_name, 'print.png')
  assert.equal(anexo.size_bytes, 14)
  assert.ok(existsSync(filePath(anexo.file_name)))
  assert.equal(repo.listForTask(tarefa.id).length, 1)
})

test('o nome no disco é gerado, não o que veio de fora', () => {
  ambienteLimpo()
  const tarefa = tasks.createTask({ title: 'Nome perigoso' })
  const anexo = saveBytes(tarefa.id, {
    original_name: '../../fora.png',
    mime: 'image/png',
    bytes: bytes('x')
  })

  assert.doesNotMatch(anexo.file_name, /[\\/]/)
  assert.match(anexo.file_name, /\.png$/)
  // o rótulo guardado perde o caminho, ficando só o nome
  assert.equal(anexo.original_name, 'fora.png')
  assert.equal(readdirSync(storageDir()).length, 1)
})

test('remover o anexo apaga o arquivo junto', () => {
  ambienteLimpo()
  const tarefa = tasks.createTask({ title: 'Some tudo' })
  const anexo = saveBytes(tarefa.id, { original_name: 'a.png', mime: 'image/png', bytes: bytes('a') })
  const caminho = filePath(anexo.file_name)

  removeAttachment(anexo.id)
  assert.equal(existsSync(caminho), false)
  assert.equal(repo.listForTask(tarefa.id).length, 0)
})

test('excluir a tarefa leva os arquivos dos anexos', () => {
  ambienteLimpo()
  const tarefa = tasks.createTask({ title: 'Com dois anexos' })
  const um = saveBytes(tarefa.id, { original_name: 'a.png', mime: 'image/png', bytes: bytes('a') })
  const dois = saveBytes(tarefa.id, { original_name: 'b.mp3', mime: 'audio/mpeg', bytes: bytes('b') })

  removeForTask(tarefa.id)
  tasks.deleteTask(tarefa.id)

  assert.equal(existsSync(filePath(um.file_name)), false)
  assert.equal(existsSync(filePath(dois.file_name)), false)
  assert.equal(repo.listForTask(tarefa.id).length, 0)
})

test('excluir a tarefa sem limpar deixaria arquivo órfão — a varredura recolhe', () => {
  ambienteLimpo()
  const tarefa = tasks.createTask({ title: 'Órfão' })
  const anexo = saveBytes(tarefa.id, { original_name: 'a.png', mime: 'image/png', bytes: bytes('a') })

  // CASCADE some com a linha, não com o arquivo
  tasks.deleteTask(tarefa.id)
  assert.ok(existsSync(filePath(anexo.file_name)))

  pruneOrphans()
  assert.equal(existsSync(filePath(anexo.file_name)), false)
})

test('a varredura não encosta em arquivo que ainda tem dono', () => {
  ambienteLimpo()
  const tarefa = tasks.createTask({ title: 'Fica' })
  const anexo = saveBytes(tarefa.id, { original_name: 'a.png', mime: 'image/png', bytes: bytes('a') })

  pruneOrphans()
  assert.ok(existsSync(filePath(anexo.file_name)))
})

test('copia arquivo do disco preservando o nome de exibição', () => {
  ambienteLimpo()
  const origem = join(mkdtempSync(join(tmpdir(), 'origem-')), 'audio da conversa.mp3')
  writeFileSync(origem, bytes('som'))

  const tarefa = tasks.createTask({ title: 'Do disco' })
  const anexo = saveFromPath(tarefa.id, origem)

  assert.equal(anexo.kind, 'audio')
  assert.equal(anexo.original_name, 'audio da conversa.mp3')
  assert.equal(anexo.mime, 'audio/mpeg')
  assert.ok(existsSync(filePath(anexo.file_name)))
})

test('classifica por mime e, na falta dele, pela extensão', () => {
  assert.equal(kindFromMime('image/png', 'x.png'), 'imagem')
  assert.equal(kindFromMime('audio/ogg', 'x.ogg'), 'audio')
  assert.equal(kindFromMime('', 'foto.JPG'), 'imagem')
  assert.equal(kindFromMime('', 'nota.opus'), 'audio')
  assert.equal(kindFromMime('', 'planilha.xlsx'), 'arquivo')
})

test('a tarefa informa quantos anexos tem', () => {
  ambienteLimpo()
  const tarefa = tasks.createTask({ title: 'Contagem' })
  saveBytes(tarefa.id, { original_name: 'a.png', mime: 'image/png', bytes: bytes('a') })
  saveBytes(tarefa.id, { original_name: 'b.png', mime: 'image/png', bytes: bytes('b') })

  assert.equal(tasks.getTask(tarefa.id)?.attachments, 2)
  assert.equal(repo.countByTask([tarefa.id]).get(tarefa.id), 2)
  closeDatabase()
})
