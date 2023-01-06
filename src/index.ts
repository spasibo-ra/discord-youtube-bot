import { GuildMember, Interaction, Snowflake, Client, Events, GatewayIntentBits, EmbedBuilder } from 'discord.js'
import {
    AudioPlayerStatus,
    AudioResource,
    entersState,
    joinVoiceChannel,
    VoiceConnectionStatus
} from '@discordjs/voice'
import play from 'play-dl'
import { MusicSubscription } from './subscription'
import { Track } from './track'

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildBans, GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildIntegrations, GatewayIntentBits.GuildWebhooks, GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping, GatewayIntentBits.DirectMessages, GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping
    ]
})

client.once(Events.ClientReady, (c) => {
    console.log(`Bot are ready! Logged in as ${c.user.tag}`)
})

const subscriptions = new Map<Snowflake, MusicSubscription>()

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if(!interaction.isChatInputCommand() || !interaction.guildId) return

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

            const exampleEmbed  = new EmbedBuilder({
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
                .slice(0, subscription.queue.length - 1)
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

client.login(process.env.TOKEN as string)