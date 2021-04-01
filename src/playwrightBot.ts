import { chromium, Browser, Page } from 'playwright'
import { PASS_PASSWORD, PASS_USERNAME, PLANNING_CACHE_TIME, SCREENSHOT_PATH } from './config'

const WEBSITE_URI = 'https://pass.imt-atlantique.fr/'
const PLANNING_URI = 'https://pass.imt-atlantique.fr/Eplug/Agenda/Agenda.asp'

let lastScreenshotTimestamp = process.env.NODE_ENV === 'dev' ? Date.now() : 0 // Init never cached

let browser: Browser

const delay = async (ms: number) => new Promise(res => setTimeout(res, ms))

const executeThenWaitForNavigation = (page: Page, actionFn: () => Promise<any>) =>
  Promise.all([page.waitForNavigation(), actionFn()]).then(() => {})

const getBrowser = () => chromium.launch({ headless: process.env.BROWSER_VISIBLE === '1' ? false : true })

const getNewPage = async () => {
  const context = await browser.newContext({})
  return context.newPage()
}

const login = async (page: Page) => {
  console.log('Logging in')
  await page.goto(WEBSITE_URI)

  // Click "SSO"
  console.log('Click SSO btn')
  await executeThenWaitForNavigation(page, () => page.click('#remoteAuth button'))

  // Login
  console.log('Send credentials')
  await page.fill('input#username', PASS_USERNAME)
  await page.fill('input#password', PASS_PASSWORD)
  await executeThenWaitForNavigation(page, () => page.click('input.btn-submit'))

  const possibleError = await page.evaluate(() => document.querySelector('#msg.errors')?.textContent?.trim())
  if (possibleError) throw new Error(`Can't log in PASS: \`${possibleError}\``)

  // OAuth 2.0 consent
  if ((await page.content()).includes('Information to be Provided to Service')) {
    console.log('OAuth consent')
    await executeThenWaitForNavigation(page, () => page.click('input[type=submit][value=Accept]'))
  }
}

const readPlanning = async (page: Page) => {
  console.log('Screenshotting planning')
  await page.goto(PLANNING_URI)
  const planningElement = await page.$('table[bgcolor="#F7F7F7"]')
  await planningElement?.screenshot({ path: SCREENSHOT_PATH })
}

const setup = async () => {
  console.log(`${new Date().toLocaleString()} - Starting to get the planning`)
  console.time('bot')

  browser = await getBrowser()
  const page = await getNewPage()
  await login(page)
  await delay(5_000) // Wait while the shitty cookies gets propagated xd
  await readPlanning(page)

  console.log('Success')
  console.timeEnd('bot')
}

export const isPlanningCached = () => Date.now() < lastScreenshotTimestamp + PLANNING_CACHE_TIME
export const screenshotDate = () => new Date(lastScreenshotTimestamp)

/** Go screenshot the planning if last one is too old */
export const screenshot = async () => {
  if (!isPlanningCached()) {
    try {
      await setup()
    } finally {
      if (process.env.KEEP_BROWSER_OPEN_WHEN_FINISHED !== '1') await browser?.close()
    }
    lastScreenshotTimestamp = Date.now()
  }
}
