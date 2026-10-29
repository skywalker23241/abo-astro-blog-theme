#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process'
import process from 'node:process'

const remote = 'theme'
const url = 'https://github.com/skywalker23241/abo-astro-blog-theme.git'
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim()

try {
  if (git('status', '--porcelain'))
    throw new Error('Commit or stash local changes before updating.')
  if (git('remote').split('\n').includes(remote)) {
    if (git('remote', 'get-url', remote).replace(/\.git$/, '') !== url.replace(/\.git$/, '')) {
      throw new Error('The theme remote points elsewhere. Review it before updating.')
    }
  } else {
    git('remote', 'add', remote, url)
  }
  execFileSync('git', ['fetch', remote, 'main'], { stdio: 'inherit' })
  execFileSync('git', ['merge', '--no-commit', '--no-ff', `${remote}/main`], { stdio: 'inherit' })
  console.log(
    'Review the changes, run lint/check/build, then commit. Use git merge --abort to cancel a pending merge.'
  )
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
