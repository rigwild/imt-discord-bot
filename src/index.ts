import { screenshot } from './playwrightBot.js'
import { run as runDiscord } from './discordBot.js'

if (process.env.RUN === 'playwright') screenshot()
else runDiscord()
