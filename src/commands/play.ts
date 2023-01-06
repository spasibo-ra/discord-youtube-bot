import { SlashCommandBuilder } from 'discord.js'

export = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Воспроизвести трек, по ссылке url: | поиск search:')
        .addStringOption(option => option.setName('url').setDescription('Ссылка на трек.').setRequired(false))
        .addStringOption(option => option.setName('search').setDescription('Поиск по названию.').setRequired(false))
        .addStringOption(option => option.setName('playlist').setDescription('Ссылка на плейлист.').setRequired(false))
}