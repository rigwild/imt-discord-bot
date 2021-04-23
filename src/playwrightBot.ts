import { chromium, Browser, Page, ElementHandle } from 'playwright'
import fetch from 'node-fetch'
import { PASS_PASSWORD, PASS_USERNAME } from './config'
import { cookiesDeserialize, cookiesPlaywrightConvert, cookiesSerialize, delay } from './utils'
import {
  argToDate,
  CachedCookies,
  getScreenshotPath,
  individualPlanningEventCache,
  isPlanningCached,
  lastScreenshotTimestamp
} from './cache'

export const WEBSITE_URI = 'https://pass.imt-atlantique.fr/'
const PLANNING_URI = 'https://pass.imt-atlantique.fr/Eplug/Agenda/Agenda.asp'
const PLANNING_EVENT_URI = (eventId: string) =>
  `https://pass.imt-atlantique.fr/Eplug/Agenda/Eve-Det.asp?NumEve=${eventId}`

let browser: Browser

const executeThenWaitForNavigation = (page: Page, actionFn: () => Promise<any>) =>
  Promise.all([page.waitForNavigation(), actionFn()]).then(() => {})

const getBrowser = () => chromium.launch({ headless: process.env.BROWSER_VISIBLE === '1' ? false : true })

const getNewPage = async () => {
  const context = await browser.newContext({ viewport: { width: 1900, height: 800 } })
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

const selectPlanningDate = async (page: Page, date: string) => {
  // Inject provided date
  await page.evaluate(date => document.querySelector('input[name=CurDat]')?.setAttribute('value', date), date)
  // Click planning icon
  await page.click('img[title="Changer de Date"]')
  // Find the selected date in the date selector popup
  const selectedDateEle = await page.evaluateHandle(() =>
    [...document.querySelectorAll('td.FondTresClair')].find(
      x => x instanceof HTMLElement && x.style?.borderColor === 'rgb(0, 0, 0)' && x.style?.color === 'black'
    )
  )
  if (!selectedDateEle) throw new Error('Could not select the date')
  // Click selected date
  await executeThenWaitForNavigation(page, () => selectedDateEle.asElement()!.click()).catch(err => {
    console.error(err)
    throw new Error('Could not click on the selected date')
  })
}

const injectPlanningData = async (page: Page) => {
  const eventElements = (await Promise.all(
    [...(await page.$$('td.GEDcellsouscategorie img[onmouseover]'))].map(x => x.$('xpath=..'))
  )) as ElementHandle<HTMLElement>[]

  // Load then inject teacher/room
  await Promise.all(
    eventElements.map(async eventElement => {
      try {
        const eventId = (await eventElement.innerHTML()).toString().match(/DetEve\(\'(.*?)\'/)?.[1]
        if (!eventId) return

        // Load event content if not cached yet
        if (!(eventId in individualPlanningEventCache)) {
          console.log(`Event id=${eventId} was not in cache, load it`)
          const eventHtml = await fetch(PLANNING_EVENT_URI(eventId), {
            headers: { cookie: cookiesSerialize(await page.context().cookies(WEBSITE_URI)) }
          }).then(res => res.text())
          individualPlanningEventCache[eventId] = {
            teacher: eventHtml.match(/Formateur.*?color=.*?>(.*?)</)?.[1] || '',
            room: eventHtml.match(/VisRes.*?>(.*?)</)?.[1].replace(/\\/g, '') || ''
          }
        }

        await eventElement.evaluate((ele, { teacher, room }) => {
          const b = ele.querySelector('b')
          if (b) b.innerHTML += `<br>${teacher} - ${room}`
        }, individualPlanningEventCache[eventId])
      } catch (err) {
        console.error(err)
      }
    })
  )

  // Remove ugly red triangles
  await page.evaluate(() =>
    [...document.querySelectorAll('img[alt="Créer un Evènement"]')].map(x => (x.parentElement!.innerHTML = ''))
  )
}

const readPlanning = async (page: Page, date: string, useDate = false) => {
  console.log('Loading planning')
  await page.goto(PLANNING_URI)

  await checkPageIsAuthenticated(page, PLANNING_URI)

  if (useDate) {
    console.log('Selecting date')
    await selectPlanningDate(page, date)
  }
  console.log('Injecting teachers and rooms')
  await injectPlanningData(page)

  await delay(100)
  const planningElement = await page.$('table[bgcolor="#F7F7F7"]')
  const planningElementBox = (await planningElement?.boundingBox())!
  await page.screenshot({
    path: getScreenshotPath(date),
    clip: {
      x: planningElementBox.x,
      y: planningElementBox.y,
      width: planningElementBox.width - 500,
      height: planningElementBox.height - 110
    },
    fullPage: true
  })
}

const checkPageIsAuthenticated = async (page: Page, thenGoTo?: string) => {
  if (!(await page.content()).includes('Préférences')) {
    console.log('Credentials did not work, clearing cookies and logging back in')
    await page.context().clearCookies()
    CachedCookies.obj = null
    await setupCredentials(page)
    if (thenGoTo) await page.goto(thenGoTo)
  }
}

const setupCredentials = async (page: Page) => {
  if (!CachedCookies.obj) {
    if (process.env.COOKIES) {
      // Skip login, format: `name=value; name2=value`
      console.log('Using provided environment cookies, skip login')
      CachedCookies.obj = cookiesDeserialize(process.env.COOKIES!)
      await page.context().addCookies(CachedCookies.obj)
      delete process.env.COOKIES
    } else {
      await login(page)
      await delay(5_000) // Wait while the shitty cookies gets propagated xd
      // Cache cookies
      CachedCookies.obj = cookiesPlaywrightConvert(await page.context().cookies(WEBSITE_URI))
    }
  } else await page.context().addCookies(CachedCookies.obj)
}

const setup = async (date: string, useDate = false) => {
  console.log(`${new Date().toLocaleString()} - Starting to get the planning`)
  console.time('bot')

  browser = await getBrowser()
  const page = await getNewPage()

  await setupCredentials(page)

  await readPlanning(page, date, useDate)

  console.log('Success')
  console.timeEnd('bot')
}

/** Go screenshot the planning if last one is too old */
export const screenshot = async (_date?: string) => {
  let date: string = _date ? _date : argToDate()
  if (!isPlanningCached(date)) {
    try {
      await setup(date, !!_date)
      lastScreenshotTimestamp[date] = Date.now()
    } finally {
      if (process.env.KEEP_BROWSER_OPEN_WHEN_FINISHED !== '1') await browser?.close()
    }
  }
}
