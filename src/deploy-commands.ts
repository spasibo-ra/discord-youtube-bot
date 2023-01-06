import * as fs from 'node:fs'
import { join } from 'path'
import { REST, Routes } from 'discord.js'

const commands: any[] = []

const commandsPath = join(process.cwd(), '/dist/commands')

const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))


for (const file of commandFiles) {
    const command = require(`./commands/${file}`)
    commands.push(command.data.toJSON())
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN as string);

(async () => {
	try {
		const data = await rest.put(
			Routes.applicationGuildCommands(process.env.CLIENTID as string, process.env.GUILDID as string),
			{ body: commands }
		) as any[]

		console.log(`Successfully reloaded ${data.length} application (/) commands.`)
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error)
	}
})()