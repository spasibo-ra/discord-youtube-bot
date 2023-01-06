import ytdl, { getInfo } from 'ytdl-core'
import { AudioResource, createAudioResource, demuxProbe } from '@discordjs/voice'
import { IAuthor, IThumbnails } from './data.interface'

const COOKIE = process.env.COOKIE

export interface TrackData {
	url: string
	title: string
	author: IAuthor
	viewCount: string
	duration: string
	thumbnails: IThumbnails[]
	onStart: () => void
	onFinish: () => void
	onError: (error: Error) => void
}

const noop = () => {}

export class Track implements TrackData {
    public readonly url: string
	public readonly title: string
	public readonly author: IAuthor 
	public readonly viewCount: string
	public readonly duration: string
	public readonly thumbnails: IThumbnails[]
	public readonly onStart: () => void
	public readonly onFinish: () => void
	public readonly onError: (error: Error) => void

    private constructor({ url, title, author, viewCount, duration, thumbnails, onStart, onFinish, onError }: TrackData) {
		this.url = url
		this.title = title
		this.author = author
		this.viewCount = viewCount
		this.duration = duration
		this.thumbnails = thumbnails
		this.onStart = onStart
		this.onFinish = onFinish
		this.onError = onError
	}

    public async createAudioResource(): Promise<AudioResource> {
        try {
            const steam = ytdl(this.url, { 
				filter: 'audioonly', 
				highWaterMark: 1<<25,
				dlChunkSize: 0,
				requestOptions: {
					headers: {
						cookie: COOKIE
					}
				} 
			})
            return await this.probeAndCreateResource(steam)
        } catch (err) {
            console.log(err, 'createAudioResource')
            throw err
        }

    }

    public async probeAndCreateResource(readableStream) {
        const { stream, type } = await demuxProbe(readableStream)
        return createAudioResource(stream, { metadata: this, inputType: type })
    }

    public static async from(url: string, methods: Pick<Track, 'onStart' | 'onFinish' | 'onError'>): Promise<Track> {
        const { videoDetails } = await getInfo(url)
        const wrappedMethods = {
			onStart() {
				wrappedMethods.onStart = noop
				methods.onStart()
			},
			onFinish() {
				wrappedMethods.onFinish = noop
				methods.onFinish()
			},
			onError(error: Error) {
				wrappedMethods.onError = noop
				methods.onError(error)
			}
        }
        return new Track({
            title: videoDetails?.title,
			author: videoDetails?.author,
			viewCount: videoDetails?.viewCount,
			duration: this.prepareTime(videoDetails?.lengthSeconds),
			thumbnails: videoDetails?.thumbnails,
            url,
            ...wrappedMethods
        })
    }

	static prepareTime(lengthSeconds: string): string {
		return [
			parseInt((+lengthSeconds / 60 / 60).toString()),
			parseInt((+lengthSeconds / 60 % 60).toString()),
			parseInt((+lengthSeconds % 60).toString())
		]
			.join(":")
			.replace(/\b(\d)\b/g, "0$1")
	}
}