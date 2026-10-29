import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const cli = require.resolve('tsx/cli')
const script = resolve('scripts/new-post.ts')

test('Chinese titles require a slug, YAML titles are escaped and existing posts stay intact', () => {
  const directory = mkdtempSync(join(tmpdir(), 'abo-new-post-'))
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [cli, script, ...args], { cwd: directory, encoding: 'utf8' })
  try {
    assert.equal(run('中文标题').status, 1)
    assert.equal(run('中文标题', '--slug').status, 1)
    const title = '_中文: "草稿"'
    assert.equal(run(title, '--slug', 'My First Post').status, 0)
    const file = join(directory, 'src/content/posts/_my-first-post.md')
    const original = readFileSync(file, 'utf8')
    assert.ok(original.includes(`title: ${JSON.stringify(title.slice(1))}`))
    assert.equal(run(title, '--slug', 'my-first-post').status, 1)
    assert.equal(readFileSync(file, 'utf8'), original)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
