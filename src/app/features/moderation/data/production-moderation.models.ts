import { PageResponse } from '../../../core/api/api.models';
import {
  ContentAdvisory,
  ContentMaturity,
  ProductionModerationStatus,
  ProductionStatus,
  ProductionStructure,
  ProductionType,
} from '../../production/data/production.models';

export type ProductionModerationDecision = 'APPROVED' | 'REJECTED';

export interface ModerationUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface ModerationProductionSummary {
  id: number;
  slug: string;
  title: string;
  type: ProductionType;
  structure: ProductionStructure;
  status: ProductionStatus;
  moderationStatus: ProductionModerationStatus;
  posterUrl?: string | null;
  submittedBy: ModerationUser;
  submittedForReviewAt?: string | null;
  reviewedBy?: ModerationUser | null;
  reviewedAt?: string | null;
  moderationNote?: string | null;
}

export interface ProductionModerationReview {
  id: number;
  decision: ProductionModerationDecision;
  reviewedBy: ModerationUser;
  note?: string | null;
  classificationAdjustments?: string | null;
  reviewedAt: string;
}

export interface RejectProductionRequest {
  note: string;
}

export interface ModeratedVideoClassificationRequest {
  videoId: number;
  maturity: ContentMaturity;
  advisories: ContentAdvisory[];
}

export interface ApproveProductionRequest {
  videos: ModeratedVideoClassificationRequest[];
}

export type ModerationProductionPage =
  PageResponse<ModerationProductionSummary>;
