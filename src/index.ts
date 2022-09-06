import { Client, Intents, Snowflake, Interaction, GuildMember, MessageEmbed } from 'discord.js'
import * as dotenv from 'dotenv'
import {
    AudioPlayerStatus,
    AudioResource,
    entersState,
    joinVoiceChannel,
    VoiceConnectionStatus
} from '@discordjs/voice'
import play from 'play-dl'
import { cfg } from '../config.json'
import { MusicSubscription } from './subscription'
import { Track } from './track'

const client = new Client({
    intents: new Intents(cfg.intents as any),
    presence: {
        status: 'idle'
    }
})
dotenv.config()
client.on('ready', () => console.log('Bot are ready!'))

client.on('messageCreate', async (message) => {
    if(!message.guild) return
    if(!client.application?.owner) await client.application?.fetch()

    if(message.content.toLowerCase() === '!setup-commands' && message.author.id === client.application?.owner?.id) {
        await message.guild.commands.set([
            {
                name: 'play',
                description: 'Воспроизвести трек, по ссылке url: | поиск search:',
                options: [
                    {
                        name: 'url',
                        type: 'STRING',
                        description: 'Ссылка на трек.',
                        required: false,
                    },
                    {
                        name: 'search',
                        type: 'STRING',
                        description: 'Поиск по названию.',
                        required: false,
                    },
                    {
                        name: 'playlist',
                        type: 'STRING',
                        description: 'Ссылка на плейлист.',
                        required: false,
                    }
                ]
            },
            {
                name: 'skip',
                description: 'Следующий трек в очереди.'
            },
            {
                name: 'queue',
                description: 'Просмотр очереди воспоизведения.'
            },
            {
                name: 'pause',
                description: 'Пауза'
            },
            {
                name: 'resume',
				description: 'Продолжить прослушивать.'
            },
            {
                name: 'leave',
				description: 'Покинуть канал.'
            }
        ])

        await message.reply('Setuped!')
    }
})

const subscriptions = new Map<Snowflake, MusicSubscription>()

client.on('interactionCreate', async (interaction: Interaction) => {
    if(!interaction.isCommand() || !interaction.guildId) return

    let subscription = subscriptions.get(interaction.guildId)

    if (interaction.commandName === 'play') {
        await interaction.deferReply({ ephemeral: true })

        const { value: url = '' } = interaction.options.get('url')! as any || ''
        const { value: search = '' } = interaction.options.get('search')! as any || ''
        const { value: playlist = '' } = interaction.options.get('playlist')! as any || ''

        if (!subscription) {
            if (interaction.member instanceof GuildMember && interaction.member.voice.channel) {
                const channel = interaction.member.voice.channel
                subscription = new MusicSubscription(
                    joinVoiceChannel({
                        channelId: channel.id,
                        guildId: channel.guild.id,
                        adapterCreator: channel.guild.voiceAdapterCreator as any
                    })
                )
                subscription.voiceConnection.on('error', (err) => console.warn(err))
                subscriptions.set(interaction.guildId, subscription)
            }
        }

        if (!subscription) {
            await interaction.followUp('Подключись к голосовому каналу и повтори.')
            return
        }

        try {
            await entersState(subscription.voiceConnection, VoiceConnectionStatus.Ready, 20e3)
        } catch (err) {
            console.warn(err)
            await interaction.followUp('Ошибка при подключении к голосовому каналу, попробуй повторить попозже.')
            return
        }

        let y_url

        // if (playlist) {
        //     const pl_inf = await preparePlaylist(playlist)
        //     console.log(subscription, 'Queue')
        //     console.log(pl_inf, 'PlayList Info')
        // }
        
        if (!url && search) {
            y_url = await findTrack(search)
        } else y_url = url

        try {
            const track = await Track.from(y_url, {
                onStart() {
                    interaction.followUp({ content: 'В эфире!', ephemeral: true }).catch(console.warn)
                },
                onFinish() {
                    interaction.followUp({ content: 'Конец!', ephemeral: true }).catch(console.warn)
                },
                onError(error) {
                    console.warn(error)
					interaction.followUp({ content: `Ошибка: ${error.message}`, ephemeral: true }).catch(console.warn)
                }
            })

            subscription.enqueue(track)

            const exampleEmbed  = new MessageEmbed({
                title: track.title,
                url: y_url,
                color: 0x0099ff,
                author: {
                    name: track.author?.name,
                    url: track.author?.user_url
                },
                thumbnail: {
                    url: track.thumbnails[1].url,
                    height: track.thumbnails[1].height,
                    width: track.thumbnails[1].width,
                },
                video: {
                    url: y_url,
                    height: 200,
                    width: 300
                },
                fields: [
                    {
                        name: 'Duration',
                        value: track.duration,
                        inline: true
                    },
                    {
                        name: 'Views',
                        value: track.viewCount,
                        inline: true
                    },
                    {
                        name: 'Requested By',
                        value: interaction.user.username,
                        inline: true
                    }
                ],
                timestamp: Date.now()
            })

            await interaction.followUp({ ephemeral: true, embeds: [exampleEmbed], fetchReply: true })
        } catch (err) {
            console.warn(err)
			await interaction.followUp('Ошибка при воспроизведении, попробуй попозже.')
        }
    } else if (interaction.commandName === 'skip') {
        if (subscription) {
            subscription.audioPlayer.stop()
			await interaction.reply('Пропусить!')
        } else {
            await interaction.reply('Тишина на сервере!')
        }
    } else if (interaction.commandName === 'queue') {
        if (subscription) {
            const current =
				subscription.audioPlayer.state.status === AudioPlayerStatus.Idle
					? `На данный момент ничего не играет!`
					: `В эфире **${(subscription.audioPlayer.state.resource as AudioResource<Track>).metadata.title}**`
            const queue = subscription.queue
                .slice(0, 5)
                .map((track, index) => `${index + 1}) ${track.title}`)
                .join('\n')

            await interaction.reply(`${current}\n\n${queue}`)
    
        } else {
            await interaction.reply('На данный момент очередь пуста!')
        }
    } else if (interaction.commandName === 'pause') {
        if (subscription) {
			subscription.audioPlayer.pause()
			await interaction.reply({ content: `Пауза!`, ephemeral: true })
		} else {
            await interaction.reply('Тишина на сервере!')
        }
    } else if (interaction.commandName === 'resume') {
		if (subscription) {
			subscription.audioPlayer.unpause();
			await interaction.reply({ content: `Возобновить!`, ephemeral: true })
		} else {
			await interaction.reply('Тишина на сервере!')
		}
	} else if (interaction.commandName === 'leave') {
		if (subscription) {
			subscription.voiceConnection.disconnect()
			subscriptions.delete(interaction.guildId)
			await interaction.reply({ content: `Вы покинули голосовой канал!`, ephemeral: true })
		} else {
			await interaction.reply('Фатал ерор!')
		}
	} else {
		await interaction.reply('Неизвестная команда.')
	}
})

const isValidURL = (value: string) => {
    return (value.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g) !== null)
}

const findTrack = async (search_data: string) => {
    const yt_data = await play.search(search_data, { limit: 1 })
    return yt_data[0]?.url
}

const preparePlaylist = async (playlist_url: string) => {
    const playlist_info = await play.playlist_info(playlist_url)
    return playlist_info
}

client.on('error', (err) => console.warn(err))

void client.login(process.env.TOKEN)