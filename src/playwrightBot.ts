import { chromium, Browser, Page, ElementHandle } from 'playwright'
import fetch from 'node-fetch'
import { PASS_PASSWORD, PASS_USERNAME } from './config'
import { delay } from './utils'
import { argToDate, getScreenshotPath, isPlanningCached, lastScreenshotTimestamp } from './cache'

const WEBSITE_URI = 'https://pass.imt-atlantique.fr/'
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

        const cookies = await page.context().cookies(WEBSITE_URI)
        const eventHtml = await fetch(PLANNING_EVENT_URI(eventId), {
          headers: { cookie: cookies.map(x => `${x.name}=${x.value}`).join('; ') }
        }).then(res => res.text())
        const teacher = eventHtml.match(/Formateur.*?color=.*?>(.*?)</)?.[1]!
        const room = eventHtml.match(/VisRes.*?>(.*?)</)?.[1].replace(/\\/g, '')!
        await eventElement.evaluate(
          (ele, { teacher, room }) => {
            const b = ele.querySelector('b')
            if (b) b.innerHTML += `<br>${teacher} - ${room}`
          },
          { teacher, room }
        )
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

const readPlanning = async (page: Page, date: string) => {
  console.log('Screenshotting planning')
  await page.goto(PLANNING_URI)

  if (date) await selectPlanningDate(page, date)
  await injectPlanningData(page)

  const planningElement = await page.$('table[bgcolor="#F7F7F7"]')
  await planningElement?.screenshot({ path: getScreenshotPath(date) })
}

const setup = async (date: string) => {
  console.log(`${new Date().toLocaleString()} - Starting to get the planning`)
  console.time('bot')

  browser = await getBrowser()
  const page = await getNewPage()

  // Skip login, format: `name=value; name2=value`
  if (process.env.COOKIES) {
    const cookies = process.env
      .COOKIES!.split('; ')
      .map(x => x.split('='))
      .map(([name, value]) => ({ name, value, url: WEBSITE_URI }))
    console.log('Using provided cookies, skip login')
    await page.context().addCookies(cookies)
  } else {
    await login(page)
    await delay(5_000) // Wait while the shitty cookies gets propagated xd
  }

  await readPlanning(page, date)

  console.log('Success')
  console.timeEnd('bot')
}

/** Go screenshot the planning if last one is too old */
export const screenshot = async (date?: string) => {
  if (!date) date = argToDate()
  if (!isPlanningCached(date)) {
    try {
      await setup(date)
      lastScreenshotTimestamp[date] = Date.now()
    } finally {
      if (process.env.KEEP_BROWSER_OPEN_WHEN_FINISHED !== '1') await browser?.close()
    }
  }
}
