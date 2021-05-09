import { WEBSITE_URI } from './playwrightBot.js'
import type { Cookie } from 'playwright'

const twoDigits = (serializable: any) => serializable.toString().padStart(2, '0')

/**
 * Transform a date object to a human-readable date format fr-FR
 * `31-12-2019`
 * @param date Date to format
 * @returns formated date
 */
export const toHumanDateFR = (date: Date) =>
  `${twoDigits(date.getDate())}/${twoDigits(date.getMonth() + 1)}/${date.getFullYear()}`

/**
 * Transform a date object to a human-readable date format
 * `2019-12-31`
 * @param date Date to format
 * @returns formated date
 */
export const toHumanDate = (date: Date) =>
  `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`

/**
 * Transform a date object to a human-readable datetime format
 * `2019-12-31 - 24:60:60`
 * @param date Date to format
 * @returns formated datetime
 * @see https://gist.github.com/rigwild/bf712322eac2244096468985ee4a5aae
 */
export const toHumanDateTime = (date: Date) =>
  `${toHumanDate(date)} - ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}:${twoDigits(date.getSeconds())}`

export const delay = (ms: number) => new Promise(res => setTimeout(res, ms))

export const cookiesSerialize = (cookies: Cookie[]) => cookies.map(x => `${x.name}=${x.value}`).join('; ')
export const cookiesPlaywrightConvert = (cookies: Cookie[]) =>
  cookies.map(({ name, value }) => ({ name, value, url: WEBSITE_URI }))
export const cookiesDeserialize = (cookies: string) =>
  cookies
    .split('; ')
    .map(x => x.split('='))
    .map(([name, value]) => ({ name, value, url: WEBSITE_URI }))
