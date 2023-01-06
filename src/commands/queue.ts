import { SlashCommandBuilder } from 'discord.js'

export = {
    data: new SlashCommandBuilder().setName('queue').setDescription('Просмотр очереди воспоизведения.')
}