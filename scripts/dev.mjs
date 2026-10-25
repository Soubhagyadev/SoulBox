import { spawn } from 'node:child_process'
import { createServer } from 'node:net'

const children = []
let shuttingDown = false

function start(label, args, env = process.env) {
  const child = spawn(process.execPath, args, { stdio: 'inherit', env })
  children.push({ label, child })
  child.once('error', (error) => {
    console.error(`${label} failed to start:`, error)
    shutdown(1)
  })
  child.once('exit', (code, signal) => {
    if (!shuttingDown) {
      console.error(`${label} exited unexpectedly (${signal || code}).`)
      shutdown(code ?? 1)
    }
  })
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const { child } of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  const timeout = setTimeout(() => {
    for (const { child } of children) if (!child.killed) child.kill('SIGKILL')
  }, 5000)
  timeout.unref()
  process.exitCode = exitCode
}

process.once('SIGINT', () => shutdown())
process.once('SIGTERM', () => shutdown())

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      probe.close((error) => error ? reject(error) : resolve(address.port))
    })
  })
}

const authPort = await findAvailablePort()
const childEnv = { ...process.env, SEALBOX_AUTH_PORT: String(authPort) }
start('SealBox SQLite authentication service', ['server/auth-server.mjs'], childEnv)
start('Vite', ['node_modules/vite/bin/vite.js'], childEnv)
