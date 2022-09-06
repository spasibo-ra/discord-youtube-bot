export interface IAuthor {
    id: string;
    name: string;
    user?: string;
    channel_url: string;
    user_url?: string;
    subscriber_count?: number;
}


export interface IThumbnails {
    height: number
    width: number
    url: string
}