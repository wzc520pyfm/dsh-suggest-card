import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import type { WorkspaceDirtiness } from '../shared/types.ts'

const execFile = promisify(execFileCallback)
const TIMEOUT = 5000
const MAX_BUFFER = 64 * 1024

export interface SessionLike {
  header?: { cwd?: unknown }
  cwd?: unknown
}

export async function workspaceDirtiness(session: SessionLike): Promise<WorkspaceDirtiness> {
  const raw = session.header?.cwd ?? session.cwd
  if (typeof raw !== 'string' || !raw.trim()) return { readable: false, reason: 'no-cwd' }
  const cwd = path.resolve(raw.trim())
  try {
    if (!(await stat(cwd)).isDirectory()) return { readable: false, reason: 'directory-missing' }
  } catch {
    return { readable: false, reason: 'directory-missing' }
  }
  try {
    const { stdout } = await execFile('git', ['status', '--porcelain=v1', '--untracked-files=normal'], {
      cwd,
      timeout: TIMEOUT,
      maxBuffer: MAX_BUFFER,
      encoding: 'utf8',
    })
    return { readable: true, dirty: stdout.trim().length > 0 }
  } catch (error) {
    if (isMissingGit(error)) return { readable: false, reason: 'git-unavailable' }
    if (isNotRepo(error)) return { readable: false, reason: 'not-repository' }
    return { readable: false, reason: 'error' }
  }
}

function isMissingGit(error: unknown): boolean {
  return isErrno(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
}

function isNotRepo(error: unknown): boolean {
  const stderr = isErrno(error) && typeof error.stderr === 'string' ? error.stderr : ''
  return /not a git repository/i.test(stderr)
}

function isErrno(error: unknown): error is NodeJS.ErrnoException & { stderr?: string } {
  return typeof error === 'object' && error !== null
}
