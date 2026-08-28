import { existsSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * Node roda o TypeScript direto (type stripping nativo do 22+), mas nao le
 * "paths" do tsconfig nem completa extensao. Este hook cobre os dois casos
 * para os testes: "@shared/x" e imports relativos sem ".ts".
 */
const root = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')

function firstExisting(...candidates) {
  return candidates.find((candidate) => existsSync(candidate))
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@shared/')) {
    const base = resolvePath(root, 'src/shared', specifier.slice('@shared/'.length))
    const file = firstExisting(`${base}.ts`, resolvePath(base, 'index.ts'))
    if (file) return next(pathToFileURL(file).href, context)
  }

  if (specifier.startsWith('.') && !/\.[mc]?[jt]s$/.test(specifier) && context.parentURL) {
    const base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier)
    const file = firstExisting(`${base}.ts`, resolvePath(base, 'index.ts'))
    if (file) return next(pathToFileURL(file).href, context)
  }

  return next(specifier, context)
}
