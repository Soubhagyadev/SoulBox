import { randomBytes, randomUUID, scrypt as scryptCallback, createHash, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { createServer } from 'node:http'

const scrypt = promisify(scryptCallback)
const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const databasePath = process.env.SEALBOX_DATABASE_PATH || resolve(projectRoot, '.data/sealbox.sqlite')
const port = Number(process.env.SEALBOX_AUTH_PORT || 4176)
const sessionLifetimeSeconds = 60 * 60 * 24 * 7
const passwordBytes = 64
const scryptOptions = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

mkdirSync(dirname(databasePath), { recursive: true })
const db = new DatabaseSync(databasePath)
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_salt BLOB NOT NULL,
    password_hash BLOB NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
`)

const statements = {
  createUser: db.prepare('INSERT INTO users (id, display_name, email, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  getUserByEmail: db.prepare('SELECT id, display_name, email, password_salt, password_hash FROM users WHERE email = ? COLLATE NOCASE'),
  createSession: db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'),
  getSession: db.prepare('SELECT users.id, users.display_name, users.email, sessions.expires_at FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ?'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  deleteExpiredSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  })
  response.end(JSON.stringify(payload))
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => {
    const separator = part.indexOf('=')
    if (separator < 0) return ['', '']
    const key = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    try {
      return [key, decodeURIComponent(value)]
    } catch {
      return [key, value]
    }
  }).filter(([key]) => key))
}

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function sessionCookie(token, maxAge = sessionLifetimeSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `sealbox_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`
}

async function readJson(request) {
  let raw = ''
  for await (const chunk of request) {
    raw += chunk
    if (raw.length > 16_384) throw Object.assign(new Error('Request is too large.'), { status: 413 })
  }
  try {
    return JSON.parse(raw || '{}')
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 })
  }
}

function currentUser(request) {
  const token = parseCookies(request.headers.cookie).sealbox_session
  if (!token) return null
  const tokenHash = hashSessionToken(token)
  const session = statements.getSession.get(tokenHash)
  if (!session) return null
  if (session.expires_at <= Date.now()) {
    statements.deleteSession.run(tokenHash)
    return null
  }
  return { id: session.id, name: session.display_name, email: session.email }
}

async function createAccountSession(userId) {
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const expiry = Date.now() + sessionLifetimeSeconds * 1000
  statements.createSession.run(hashSessionToken(token), userId, now.toISOString(), expiry)
  statements.deleteExpiredSessions.run(Date.now())
  return { token, expiry }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  try {
    if (request.method === 'GET' && url.pathname === '/api/auth/session') {
      const user = currentUser(request)
      return sendJson(response, 200, { authenticated: Boolean(user), user })
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/signup') {
      const body = await readJson(request)
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const password = typeof body.password === 'string' ? body.password : ''
      if (name.length < 1 || name.length > 100) return sendJson(response, 400, { error: 'Enter a name up to 100 characters.' })
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return sendJson(response, 400, { error: 'Enter a valid email address.' })
      if (password.length < 8 || password.length > 1024) return sendJson(response, 400, { error: 'Use a password between 8 and 1024 characters.' })

      const salt = randomBytes(16)
      const passwordHash = await scrypt(password, salt, passwordBytes, scryptOptions)
      const userId = randomUUID()
      try {
        statements.createUser.run(userId, name, email, salt, passwordHash, new Date().toISOString())
      } catch (error) {
        if (error?.errcode === 2067 || error?.errcode === 1555) {
          return sendJson(response, 409, { error: 'An account with this email already exists.' })
        }
        throw error
      }
      const session = await createAccountSession(userId)
      return sendJson(response, 201, { user: { id: userId, name, email } }, { 'Set-Cookie': sessionCookie(session.token) })
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      const body = await readJson(request)
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const password = typeof body.password === 'string' ? body.password : ''
      const user = statements.getUserByEmail.get(email)
      if (!user || password.length > 1024) return sendJson(response, 401, { error: 'Email or password is incorrect.' })
      const suppliedHash = await scrypt(password, user.password_salt, passwordBytes, scryptOptions)
      if (!timingSafeEqual(suppliedHash, user.password_hash)) return sendJson(response, 401, { error: 'Email or password is incorrect.' })
      const session = await createAccountSession(user.id)
      return sendJson(response, 200, { user: { id: user.id, name: user.display_name, email: user.email } }, { 'Set-Cookie': sessionCookie(session.token) })
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      const token = parseCookies(request.headers.cookie).sealbox_session
      if (token) statements.deleteSession.run(hashSessionToken(token))
      return sendJson(response, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) })
    }

    return sendJson(response, 404, { error: 'Not found.' })
  } catch (error) {
    const status = Number(error?.status) || 500
    if (status >= 500) console.error('SealBox auth request failed:', error)
    return sendJson(response, status, { error: status >= 500 ? 'The authentication service could not complete the request.' : error.message })
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`SealBox SQLite auth service listening on http://127.0.0.1:${port}`)
})

function close() {
  server.close(() => {
    db.close()
    process.exit(0)
  })
}
process.once('SIGINT', close)
process.once('SIGTERM', close)
