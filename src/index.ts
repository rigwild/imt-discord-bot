import { screenshot } from './playwrightBot'
import { run as runDiscord } from './discordBot'

if (process.env.RUN === 'playwright') screenshot()
else runDiscord()
