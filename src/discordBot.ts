import Discord from 'discord.js'
import { basename } from 'path'
import { DISCORD_TOKEN } from './config.js'
import { screenshot } from './playwrightBot.js'
import { argToDate, getScreenshotPath, isPlanningCached, screenshotDate } from './cache.js'
import { toHumanDateTime } from './utils.js'

// https://discordapp.com/oauth2/authorize?client_id=826932482590638100&scope=bot&permissions=2048

let client: Discord.Client

const getEmbed = (planningDate: string) => {
  const captureDate = screenshotDate(planningDate)
  const screenshotPath = getScreenshotPath(planningDate)
  const embed = new Discord.MessageEmbed()
    .setTitle(`Planning à la date du ${planningDate}`)
    .attachFiles([screenshotPath])
    .setImage(`attachment://${basename(screenshotPath)}`)
  if (captureDate) embed.setFooter(`Date de capture: ${toHumanDateTime(captureDate)}`)
  return embed
}

const sendPlanning = (channel: Discord.Channel, planningDate: string) => {
  if (channel?.isText()) return channel.send({ embed: getEmbed(planningDate) })
}

const messageHandler = async (msg: Discord.Message) => {
  const channel = msg.channel
  const msgContent = msg.content.trim()
  if (!msgContent.startsWith('!')) return

  const msgAgs = msgContent
    .split(' ')
    .map(x => x.trim())
    .slice(1)

  if (msgContent === '!help')
    channel.send({
      embed: new Discord.MessageEmbed()
        .setTitle('Liste des commandes')
        .addField('`!help`', "Afficher l'aide")
        .addField('`!planning`', "Afficher l'emploi du temps")
        .addField('`!planning 1`', "Afficher l'emploi du temps dans `x` semaine(s)")
        .addField('`!planning 31/12/2021`', "Afficher l'emploi du temps à une date")
        .addField('Repo GitHub', '[rigwild/imt-discord-bot](https://github.com/rigwild/imt-discord-bot)')
    })
  else if (msgContent.startsWith('!planning')) {
    let tryCount = 0

    const run = async () => {
      try {
        const planningDate = argToDate(msgAgs[0])
        if (!isPlanningCached(planningDate))
          await Promise.all([
            tryCount === 0 ? msg.react('⌛') : null,
            screenshot(msgAgs.length > 0 ? planningDate : undefined)
          ])
        await sendPlanning(channel, planningDate)
      } catch (err) {
        console.error(err)
        await channel.send(
          `❌ Error! 🤨 ${tryCount === 0 ? 'Let me try it one more time... ' : ''}- ${err.message}`.slice(0, 1800)
        )
        if (tryCount === 0) {
          tryCount++
          await run()
        }
      } finally {
        await msg.reactions.resolve('⌛')?.users.remove(client.user?.id)
      }
    }
    await run()
  }
}

const registerEvents = () => {
  client.on('ready', () => console.log(`Connected with ${client.user?.tag}`))
  client.on('message', messageHandler)
}

export const run = async () => {
  client = new Discord.Client()
  registerEvents()
  await client.login(DISCORD_TOKEN)
}
