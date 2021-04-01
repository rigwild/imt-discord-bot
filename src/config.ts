import { resolve as pathResolve } from 'path'
import { config as dotenvSafe } from 'dotenv-safe'

dotenvSafe({
  path: pathResolve(__dirname, '..', '.env'),
  example: pathResolve(__dirname, '..', '.env.example')
})

export const { PASS_USERNAME, PASS_PASSWORD, DISCORD_TOKEN } = process.env as Record<string, string>

export const PLANNING_CACHE_TIME = parseInt(process.env.PLANNING_CACHE_TIME!)

export const SCREENSHOT_PATH = pathResolve(__dirname, '..', 'planning.png')