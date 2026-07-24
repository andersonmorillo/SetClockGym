#!/usr/bin/env node
// Cross-platform setup/dev runner (Windows, macOS, Linux). No Docker needed.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const backendDir = path.join(rootDir, 'backend')
const isWindows = process.platform === 'win32'

const venvDir = path.join(backendDir, '.venv')
const venvPython = isWindows
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python')
const venvPip = isWindows
  ? path.join(venvDir, 'Scripts', 'pip.exe')
  : path.join(venvDir, 'bin', 'pip')
const npmCmd = isWindows ? 'npm.cmd' : 'npm'

/** Load KEY=VALUE pairs from a .env file into process.env (does not override existing). */
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    if (!key || process.env[key] !== undefined) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

loadEnvFile(path.join(rootDir, '.env'))

const apiHost = process.env.API_HOST || '0.0.0.0'
const apiPort = process.env.API_PORT || '8000'
const vitePort = process.env.VITE_PORT || '5173'

function findSystemPython() {
  for (const cmd of isWindows ? ['python', 'py'] : ['python3', 'python']) {
    const result = spawnSync(cmd, ['--version'], { stdio: 'ignore' })
    if (!result.error && result.status === 0) return cmd
  }
  return null
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: isWindows, ...options })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function setup() {
  if (!existsSync(venvPython)) {
    const python = findSystemPython()
    if (!python) {
      console.error('Python was not found. Install Python 3 and try again.')
      process.exit(1)
    }
    console.log('Creating Python virtual environment...')
    run(python, ['-m', 'venv', venvDir])
  }

  console.log('Installing backend packages...')
  run(venvPip, ['install', '-r', path.join(backendDir, 'requirements.txt')])

  if (!existsSync(path.join(rootDir, 'node_modules'))) {
    console.log('Installing frontend packages...')
    run(npmCmd, ['install'], { cwd: rootDir })
  } else {
    console.log('Frontend packages already installed, skipping npm install.')
  }

  if (!existsSync(path.join(rootDir, '.env'))) {
    console.log('No .env found. Copy .env.example to .env and edit before running.')
  }

  console.log('\nSetup complete. Run "npm run dev:all" to start the app.')
}

function spawnApi() {
  if (!existsSync(venvPython)) {
    console.error('Backend virtual environment not found. Run "npm run setup" first.')
    process.exit(1)
  }
  return spawn(
    venvPython,
    ['-m', 'uvicorn', 'main:app', '--reload', '--host', apiHost, '--port', String(apiPort)],
    { cwd: backendDir, stdio: 'inherit', env: process.env },
  )
}

function spawnVite() {
  return spawn(npmCmd, ['run', 'dev', '--', '--host', '--port', String(vitePort)], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: isWindows,
    env: process.env,
  })
}

function runApiOnly() {
  const api = spawnApi()
  api.on('exit', (code) => process.exit(code ?? 0))
}

function runAll() {
  console.log(`Starting API on http://${apiHost}:${apiPort} and app on http://0.0.0.0:${vitePort}`)
  console.log(`Open http://localhost:${vitePort} once both are ready. Press Ctrl+C to stop.\n`)

  const children = [spawnApi(), spawnVite()]
  let shuttingDown = false

  const shutdown = () => {
    if (shuttingDown) return
    shuttingDown = true
    for (const child of children) {
      if (!child.killed) child.kill()
    }
  }

  process.on('SIGINT', () => {
    shutdown()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    shutdown()
    process.exit(0)
  })

  for (const child of children) {
    child.on('exit', (code) => {
      shutdown()
      process.exit(code ?? 0)
    })
  }
}

const mode = process.argv[2]

switch (mode) {
  case 'setup':
    setup()
    break
  case 'api':
    runApiOnly()
    break
  case 'all':
    runAll()
    break
  default:
    console.error('Usage: node scripts/dev.mjs <setup|api|all>')
    process.exit(1)
}
