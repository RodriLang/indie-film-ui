import { PageResponse } from '../../../core/api/api.models';

import {
  ProductionStructure,
  ProductionType,
  ProductionVideoKind,
} from './production.models';

export type ResumeType =
  | 'START'
  | 'RESUME_VIDEO'
  | 'NEXT_EPISODE'
  | 'COMPLETED';

export interface UpdateVideoProgressRequest {
  positionSeconds: number;
  durationSeconds: number;
  ended: boolean;
}

export interface VideoProgress {
  videoId: number;
  kind: ProductionVideoKind;
  title?: string | null;
  episodeNumber?: number | null;
  positionSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  completed: boolean;
  completedAt?: string | null;
  lastWatchedAt: string;
}

export interface ProductionProgress {
  resumeVideoId: number | null;
  resumePositionSeconds: number;
  resumeType: ResumeType;
  videos: VideoProgress[];
}

export interface ContinueWatching {
  productionId: number;
  slug: string;
  productionTitle: string;
  posterUrl?: string | null;
  productionType: ProductionType;
  releaseYear?: number | null;
  structure: ProductionStructure;

  videoId: number;
  kind: ProductionVideoKind;
  videoTitle?: string | null;
  episodeNumber?: number | null;
  thumbnailUrl?: string | null;

  positionSeconds: number;
  resumePositionSeconds: number;
  durationSeconds?: number | null;
  progressPercent: number;

  resumeType: ResumeType;
  lastWatchedAt: string;
}

export interface WatchHistory {
  productionId: number;
  slug: string;
  productionTitle: string;
  posterUrl?: string | null;
  productionType: ProductionType;
  releaseYear?: number | null;
  structure: ProductionStructure;

  videoId: number;
  kind: ProductionVideoKind;
  videoTitle?: string | null;
  episodeNumber?: number | null;
  thumbnailUrl?: string | null;

  positionSeconds: number;
  resumePositionSeconds: number;
  durationSeconds: number;
  progressPercent: number;

  completed: boolean;
  completedAt?: string | null;
  lastWatchedAt: string;
}

export type ContinueWatchingPage = PageResponse<ContinueWatching>;

export type WatchHistoryPage = PageResponse<WatchHistory>;
