import { resolve as pathResolve } from 'path'
import { PLANNING_CACHE_TIME, SCREENSHOTS_DIR_PATH } from './config'
import { toHumanDateFR, cookiesDeserialize } from './utils'

const dateOrDefault = (date?: string) => (!!date ? date : '1')

/** Convert week offset numbers (e.g.`1`, `-1`) to FR date string (i.e. `31-12-2021`) (`0` is current week) */
const convertNumberWeekOffsetToDate = (offset: string) =>
  toHumanDateFR(new Date(Date.now() + parseInt(offset, 10) * 3600 * 24 * 7 * 1000))

/**
 * Convert a user-provided date argument to a valid FR date (i.e. `31-12-2021`)
 *
 * - Nothing: current week
 * - Week offset: `-1`, `1`, `17` (`0` is current week)
 * - Date
 * @param _date
 * @returns an hopefully-valid FR date
 */
export const argToDate = (_date?: string) => {
  let date = !!_date ? _date.trim() : '0'

  // Convert week offset
  if (date.length <= 5 && /^\-?[0-9]+$/.test(date)) date = convertNumberWeekOffsetToDate(date)

  // FR date
  if (/^[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}$/.test(date)) return date

  throw new Error('Invalid date format! Date should be in FR format (e.g. `31/12/2021`)')
}

export const isPlanningCached = (date: string) =>
  date in lastScreenshotTimestamp && Date.now() < lastScreenshotTimestamp[date] + PLANNING_CACHE_TIME

export const screenshotDate = (date: string) =>
  date in lastScreenshotTimestamp ? new Date(lastScreenshotTimestamp[dateOrDefault(date)]) : null

export const getScreenshotPath = (date: string) => pathResolve(SCREENSHOTS_DIR_PATH, `${date.replace(/\//g, '_')}.png`)

// Map of screenshot timestamps
export const lastScreenshotTimestamp: Record<string, number> = {
  [argToDate()]: process.env.NODE_ENV === 'dev' ? Date.now() : 0 // Init never cached
}

// Map of individual planning event http cache
export const individualPlanningEventCache: Record<string, { teacher: string; room: string }> = {}

// Cookies cache
export class CachedCookies {
  public static obj: ReturnType<typeof cookiesDeserialize> | null = null
}
