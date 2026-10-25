import { randomBytes, randomUUID, scrypt as scryptCallback, createHash, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { createClient } from '@libsql/client'

const scrypt = promisify(scryptCallback)
const sessionLifetimeSeconds = 60 * 60 * 24 * 7
const passwordBytes = 64
const scryptOptions = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
let client
let schemaReady

function getClient() {
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  if (!url || !authToken) {
    throw Object.assign(new Error('Turso is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.'), { status: 503 })
  }
  client ??= createClient({ url, authToken })
  return client
}

async function ensureSchema(database) {
  schemaReady ??= (async () => {
    await database.execute(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_salt BLOB NOT NULL,
      password_hash BLOB NOT NULL,
      created_at TEXT NOT NULL
    )`)
    await database.execute(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )`)
    await database.execute('CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)')
  })().catch((error) => {
    schemaReady = undefined
    throw error
  })
  return schemaReady
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

function sendJson(response, status, payload, headers = {}) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value)
  response.end(JSON.stringify(payload))
}

async function readJson(request) {
  if (request.body !== undefined) {
    if (typeof request.body === 'string') {
      try { return JSON.parse(request.body || '{}') } catch {
        throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 })
      }
    }
    return request.body ?? {}
  }

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

async function currentUser(database, request) {
  const token = parseCookies(request.headers.cookie).sealbox_session
  if (!token) return null
  const tokenHash = hashSessionToken(token)
  const result = await database.execute({
    sql: `SELECT users.id, users.display_name, users.email, sessions.expires_at
      FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?`,
    args: [tokenHash],
  })
  const session = result.rows[0]
  if (!session) return null
  if (Number(session.expires_at) <= Date.now()) {
    await database.execute({ sql: 'DELETE FROM sessions WHERE token_hash = ?', args: [tokenHash] })
    return null
  }
  return { id: session.id, name: session.display_name, email: session.email }
}

async function createAccountSession(database, userId) {
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const expiry = Date.now() + sessionLifetimeSeconds * 1000
  await database.execute({
    sql: 'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    args: [hashSessionToken(token), userId, now.toISOString(), expiry],
  })
  await database.execute({ sql: 'DELETE FROM sessions WHERE expires_at <= ?', args: [Date.now()] })
  return token
}

function isDuplicateEmail(error) {
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|SQLITE_CONSTRAINT_PRIMARYKEY/i.test(String(error?.message || error?.code || ''))
}

async function handleAuth(operation, request, response) {
  const method = operation === 'session' ? 'GET' : 'POST'
  if (request.method !== method) {
    response.setHeader('Allow', method)
    return sendJson(response, 405, { error: 'Method not allowed.' })
  }

  try {
    const database = getClient()
    await ensureSchema(database)

    if (operation === 'session') {
      const user = await currentUser(database, request)
      return sendJson(response, 200, { authenticated: Boolean(user), user })
    }

    if (operation === 'logout') {
      const token = parseCookies(request.headers.cookie).sealbox_session
      if (token) await database.execute({ sql: 'DELETE FROM sessions WHERE token_hash = ?', args: [hashSessionToken(token)] })
      return sendJson(response, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) })
    }

    const body = await readJson(request)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return sendJson(response, 400, { error: 'Request body must be a JSON object.' })
    }

    if (operation === 'signup') {
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
        await database.execute({
          sql: 'INSERT INTO users (id, display_name, email, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          args: [userId, name, email, salt, passwordHash, new Date().toISOString()],
        })
      } catch (error) {
        if (isDuplicateEmail(error)) return sendJson(response, 409, { error: 'An account with this email already exists.' })
        throw error
      }
      const token = await createAccountSession(database, userId)
      return sendJson(response, 201, { user: { id: userId, name, email } }, { 'Set-Cookie': sessionCookie(token) })
    }

    if (operation === 'login') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const password = typeof body.password === 'string' ? body.password : ''
      const result = await database.execute({
        sql: 'SELECT id, display_name, email, password_salt, password_hash FROM users WHERE email = ? COLLATE NOCASE',
        args: [email],
      })
      const user = result.rows[0]
      if (!user || password.length > 1024) return sendJson(response, 401, { error: 'Email or password is incorrect.' })
      const salt = Buffer.from(user.password_salt)
      const expectedHash = Buffer.from(user.password_hash)
      const suppliedHash = await scrypt(password, salt, passwordBytes, scryptOptions)
      if (expectedHash.length !== suppliedHash.length || !timingSafeEqual(suppliedHash, expectedHash)) {
        return sendJson(response, 401, { error: 'Email or password is incorrect.' })
      }
      const token = await createAccountSession(database, user.id)
      return sendJson(response, 200, { user: { id: user.id, name: user.display_name, email: user.email } }, { 'Set-Cookie': sessionCookie(token) })
    }

    return sendJson(response, 404, { error: 'Not found.' })
  } catch (error) {
    const status = Number(error?.status) || 500
    if (status >= 500) console.error('SealBox Vercel auth request failed:', error)
    return sendJson(response, status, { error: status >= 500 ? 'The authentication service could not complete the request.' : error.message })
  }
}

export function createAuthHandler(operation) {
  return (request, response) => handleAuth(operation, request, response)
}
