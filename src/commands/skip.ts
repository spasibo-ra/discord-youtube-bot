import { SlashCommandBuilder } from 'discord.js'

export = {
    data: new SlashCommandBuilder().setName('skip').setDescription('Следующий трек в очереди.')
}