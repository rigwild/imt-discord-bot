import { mkdirSync } from 'fs'
import { resolve as pathResolve } from 'path'
import { config as dotenvSafe } from 'dotenv-safe'

dotenvSafe({
  path: new URL('../.env', import.meta.url).pathname,
  example: new URL('../.env.example', import.meta.url).pathname
})

export const { PASS_USERNAME, PASS_PASSWORD, DISCORD_TOKEN } = process.env as Record<string, string>

export const PLANNING_CACHE_TIME = parseInt(process.env.PLANNING_CACHE_TIME!)

export const SCREENSHOTS_DIR_PATH = new URL('../screenshots', import.meta.url).pathname

try {
  mkdirSync(SCREENSHOTS_DIR_PATH)
} catch {}
