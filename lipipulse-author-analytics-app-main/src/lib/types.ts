export type PeriodKey = "7D" | "30D" | "90D" | "365D" | "ALL";

export interface Channel {
  id: string;
  name: string;
  handle: string;
  colorHex: string;
  baselineFollowers: number;
  createdAt: string;
}

export interface Story {
  id: string;
  channelId: string;
  title: string;
  coverUri: string | null;
  status: "ongoing" | "completed";
  createdAt: string;
}

export interface Episode {
  id: string;
  storyId: string;
  episodeNumber: number;
  title: string;
  publishedDate: string;
}

export interface ChannelSnapshot {
  id: string;
  channelId: string;
  snapshotDate: string;
  followers: number;
  totalViews: number;
  totalStories: number;
  isBaseline: 0 | 1;
}

export interface StorySnapshot {
  id: string;
  storyId: string;
  snapshotDate: string;
  views: number;
  rating: number;
  ratingCount: number;
  episodeCount: number;
  isBaseline: 0 | 1;
}

export interface EpisodeSnapshot {
  id: string;
  episodeId: string;
  snapshotDate: string;
  views: number;
  rating: number;
  isBaseline: 0 | 1;
}

export interface AppSettings {
  geminiKey: string;
  seededOn: string | null;
}

export interface AppData {
  channels: Channel[];
  stories: Story[];
  episodes: Episode[];
  channelSnapshots: ChannelSnapshot[];
  storySnapshots: StorySnapshot[];
  episodeSnapshots: EpisodeSnapshot[];
  settings: AppSettings;
}

export const EMPTY_DATA: AppData = {
  channels: [],
  stories: [],
  episodes: [],
  channelSnapshots: [],
  storySnapshots: [],
  episodeSnapshots: [],
  settings: { geminiKey: "", seededOn: null },
};

export const CHANNEL_PALETTE = ["#C9B8FF", "#B8F0D8", "#FFD3B6", "#A8D8FF", "#FFC9DE"];

let seq = 0;
export function uid(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
