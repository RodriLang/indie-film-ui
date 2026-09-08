import { PageResponse } from '../../../core/api/api.models';

export type ProductionType =
  | 'SHORT_FILM'
  | 'DOCUMENTARY'
  | 'MUSIC_VIDEO'
  | 'ANIMATION'
  | 'ADVERTISING'
  | 'EXPERIMENTAL'
  | 'VIDEO_ART'
  | 'OTHER';

export type ProductionStructure = 'SINGLE' | 'EPISODIC';
export type ProductionStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'REMOVED';
export type ProductionModerationStatus =
  | 'NOT_SUBMITTED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';
export type ProductionVideoKind = 'MAIN' | 'EPISODE' | 'TRAILER' | 'EXTRA';
export type TitleArtPosition = 'TOP' | 'CENTER' | 'BOTTOM';
export type VideoProviderType = 'YOUTUBE';
export type VideoAssetStatus = 'UNKNOWN' | 'AVAILABLE' | 'UNAVAILABLE';

export type CreditRole =
  | 'DIRECTOR'
  | 'ASSISTANT_DIRECTOR'
  | 'WRITER'
  | 'PRODUCER'
  | 'EXECUTIVE_PRODUCER'
  | 'CINEMATOGRAPHER'
  | 'CAMERA_OPERATOR'
  | 'EDITOR'
  | 'COLORIST'
  | 'SOUND'
  | 'SOUND_DESIGNER'
  | 'MUSIC'
  | 'ART_DIRECTION'
  | 'PRODUCTION_DESIGN'
  | 'VFX'
  | 'ANIMATION'
  | 'ACTOR'
  | 'OTHER';

export type ContentMaturity = 'GENERAL' | 'ADULT_18';

export type ContentAdvisory =
  | 'STRONG_LANGUAGE'
  | 'NUDITY'
  | 'SEXUAL_CONTENT'
  | 'DRUG_USE'
  | 'VIOLENCE'
  | 'GRAPHIC_VIOLENCE';

export type PlaybackAccessCode =
  | 'LOGIN_REQUIRED'
  | 'BIRTH_DATE_REQUIRED'
  | 'UNDERAGE'
  | 'ADULT_CONSENT_REQUIRED'
  | 'UNAVAILABLE';

export interface ProductionVideoPlayback {
  videoId: number;
  provider: VideoProviderType;
  externalId: string;
}

export interface Genre {
  id: number;
  slug: string;
  name: string;
}

export interface CreatorSummary {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface VideoAsset {
  id: number;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  status: VideoAssetStatus;
}

export interface ProductionVideo {
  id: number;
  kind: ProductionVideoKind;
  title?: string | null;
  episodeNumber?: number | null;
  displayOrder: number;
  maturity: ContentMaturity;
  advisories: ContentAdvisory[];
  videoAsset: VideoAsset;
}

export interface ProductionCredit {
  id: number;
  user?: CreatorSummary | null;
  personName?: string | null;
  role: CreditRole;
  roleDetail?: string | null;
  displayOrder: number;
}

export interface ProductionPreviewVideo {
  videoId: number;
  thumbnailUrl?: string | null;
}

export interface ProductionSummary {
  id: number;
  slug: string;
  title: string;
  posterUrl?: string | null;
  type: ProductionType;
  releaseYear?: number | null;
  structure: ProductionStructure;
  submittedBy: CreatorSummary;
  trailer?: ProductionPreviewVideo | null;
  likeCount: number;
  likedByCurrentUser: boolean;
}

export interface OwnProductionSummary {
  id: number;
  slug: string;
  title: string;
  posterUrl?: string | null;
  type: ProductionType;
  releaseYear?: number | null;
  structure: ProductionStructure;
  status: ProductionStatus;
  moderationStatus: ProductionModerationStatus;
  likeCount: number;
  updatedAt: string;
  publishedAt?: string | null;
}

export interface Production extends ProductionSummary {
  description?: string | null;
  status: ProductionStatus;
  moderationStatus: ProductionModerationStatus;
  genres: Genre[];
  posterFocalX: number;
  posterFocalY: number;
  landscapeArtworkUrl?: string | null;
  titleArtUrl?: string | null;
  titleArtPosition?: TitleArtPosition | null;
  videos: ProductionVideo[];
  credits: ProductionCredit[];
  publishedAt?: string | null;
  submittedForReviewAt?: string | null;
  reviewedAt?: string | null;
  moderationNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionCreditRequest {
  userId?: number | null;
  personName?: string | null;
  role: CreditRole;
  roleDetail?: string | null;
  displayOrder: number;
}

export interface CreateProductionRequest {
  title: string;
  description?: string | null;
  type: ProductionType;
  releaseYear?: number | null;
  structure: ProductionStructure;
  credits?: ProductionCreditRequest[];
  genreIds?: number[];
}

export interface UpdateProductionRequest {
  title?: string | null;
  description?: string | null;
  type?: ProductionType | null;
  releaseYear?: number | null;
  genreIds?: number[];
}

export interface CreateProductionVideoRequest {
  kind: ProductionVideoKind;
  videoUrl: string;
  title?: string | null;
  episodeNumber?: number | null;
  displayOrder?: number | null;
  maturity?: ContentMaturity;
  advisories?: ContentAdvisory[];
}

export interface UpdateProductionVideoRequest {
  title?: string | null;
  episodeNumber?: number | null;
  displayOrder?: number | null;
  maturity?: ContentMaturity;
  advisories?: ContentAdvisory[];
}

export interface UpdateProductionArtworkRequest {
  posterUrl?: string | null;
  posterFocalX?: number | null;
  posterFocalY?: number | null;
  landscapeArtworkUrl?: string | null;
  titleArtUrl?: string | null;
  titleArtPosition?: TitleArtPosition | null;
}

export interface ProductionLikeResponse {
  liked: boolean;
  likeCount: number;
}

export type ProductionPage = PageResponse<ProductionSummary>;
export type OwnProductionPage = PageResponse<OwnProductionSummary>;

export const PRODUCTION_TYPE_OPTIONS: readonly {
  value: ProductionType;
  label: string;
}[] = [
  { value: 'SHORT_FILM', label: 'Cortometraje' },
  { value: 'DOCUMENTARY', label: 'Documental' },
  { value: 'MUSIC_VIDEO', label: 'Videoclip' },
  { value: 'ANIMATION', label: 'Animación' },
  { value: 'ADVERTISING', label: 'Publicidad' },
  { value: 'EXPERIMENTAL', label: 'Experimental' },
  { value: 'VIDEO_ART', label: 'Video arte' },
  { value: 'OTHER', label: 'Otro' },
];

export const CREDIT_ROLE_OPTIONS: readonly {
  value: CreditRole;
  label: string;
}[] = [
  { value: 'DIRECTOR', label: 'Dirección' },
  { value: 'ASSISTANT_DIRECTOR', label: 'Asistencia de dirección' },
  { value: 'WRITER', label: 'Guion' },
  { value: 'PRODUCER', label: 'Producción' },
  { value: 'EXECUTIVE_PRODUCER', label: 'Producción ejecutiva' },
  { value: 'CINEMATOGRAPHER', label: 'Dirección de fotografía' },
  { value: 'CAMERA_OPERATOR', label: 'Cámara' },
  { value: 'EDITOR', label: 'Edición' },
  { value: 'COLORIST', label: 'Color' },
  { value: 'SOUND', label: 'Sonido' },
  { value: 'SOUND_DESIGNER', label: 'Diseño sonoro' },
  { value: 'MUSIC', label: 'Música' },
  { value: 'ART_DIRECTION', label: 'Dirección de arte' },
  { value: 'PRODUCTION_DESIGN', label: 'Diseño de producción' },
  { value: 'VFX', label: 'VFX' },
  { value: 'ANIMATION', label: 'Animación' },
  { value: 'ACTOR', label: 'Actuación' },
  { value: 'OTHER', label: 'Otro' },
];

export function productionTypeLabel(type: ProductionType): string {
  return (
    PRODUCTION_TYPE_OPTIONS.find((option) => option.value === type)?.label ??
    type
  );
}

export function creditRoleLabel(role: CreditRole): string {
  return (
    CREDIT_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role
  );
}

export const CONTENT_MATURITY_OPTIONS: readonly {
  value: ContentMaturity;
  label: string;
}[] = [
  { value: 'GENERAL', label: 'General' },
  { value: 'ADULT_18', label: '+18' },
];

export const CONTENT_ADVISORY_OPTIONS: readonly {
  value: ContentAdvisory;
  label: string;
}[] = [
  { value: 'STRONG_LANGUAGE', label: 'Lenguaje adulto' },
  { value: 'NUDITY', label: 'Desnudez' },
  { value: 'SEXUAL_CONTENT', label: 'Contenido sexual' },
  { value: 'DRUG_USE', label: 'Consumo de drogas' },
  { value: 'VIOLENCE', label: 'Violencia' },
  { value: 'GRAPHIC_VIOLENCE', label: 'Violencia gráfica' },
];

export function contentMaturityLabel(maturity: ContentMaturity): string {
  return (
    CONTENT_MATURITY_OPTIONS.find((option) => option.value === maturity)
      ?.label ?? maturity
  );
}

export function contentAdvisoryLabel(advisory: ContentAdvisory): string {
  return (
    CONTENT_ADVISORY_OPTIONS.find((option) => option.value === advisory)
      ?.label ?? advisory
  );
}
