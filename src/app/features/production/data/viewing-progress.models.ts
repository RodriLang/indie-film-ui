import { ProductionVideoKind } from './production.models';

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
