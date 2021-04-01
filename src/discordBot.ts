import Discord from 'discord.js'
import { basename } from 'path'
import { DISCORD_TOKEN, SCREENSHOT_PATH } from './config'
import { isPlanningCached, screenshot, screenshotDate } from './playwrightBot'
import { toHumanDateTime } from './utils'

// https://discordapp.com/oauth2/authorize?client_id=826932482590638100&scope=bot&permissions=10240

let client: Discord.Client

const getEmbed = () =>
  new Discord.MessageEmbed()
    .attachFiles([SCREENSHOT_PATH])
    .setImage(`attachment://${basename(SCREENSHOT_PATH)}`)
    .setFooter(`Date de capture: ${toHumanDateTime(screenshotDate())}`)

const sendPlanning = (channel: Discord.Channel) => {
  if (channel?.isText()) return channel.send({ embed: getEmbed() })
}

const messageHandler = async (msg: Discord.Message) => {
  const channel = msg.channel
  if (msg.content === '!help')
    channel.send({
      embed: new Discord.MessageEmbed()
        .addField('`!help`', "Afficher l'aide")
        .addField('`!planning`', "Afficher l'emploi du temps")
        .addField('Repo GitHub', '[rigwild/imt-discord-bot](https://github.com/rigwild/imt-discord-bot)')
    })
  else if (msg.content === '!planning') {
    try {
      if (!isPlanningCached()) {
        const [reaction] = await Promise.all([msg.react('⌛'), screenshot()])
        await reaction.remove().catch(() => {})
      }
      await sendPlanning(channel)
    } catch (err) {
      console.error(err)
      await channel.send(`🤨 Error! ${err.message}`)
      await msg.reactions.cache
        .get('⌛')
        ?.remove()
        .catch(() => {})
    }
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
