import { PageResponse } from '../../../core/api/api.models';
import { CreditRole, ProductionSummary } from '../../production/data/production.models';

export type CreatorSpecialty =
  | 'DIRECTING'
  | 'SCREENWRITING'
  | 'PRODUCING'
  | 'CINEMATOGRAPHY'
  | 'CAMERA'
  | 'EDITING'
  | 'COLOR'
  | 'SOUND'
  | 'MUSIC'
  | 'ART_DIRECTION'
  | 'PRODUCTION_DESIGN'
  | 'VFX'
  | 'ANIMATION'
  | 'ACTING';


export interface CreatorCreditSuggestion {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  specialties: CreatorSpecialty[];
}

export interface CreatorProfile {
  id: number;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  specialties: CreatorSpecialty[];
}

export interface CreatorRole {
  role: CreditRole;
  roleDetail?: string | null;
}

export interface CreatorParticipation {
  production: ProductionSummary;
  credits: CreatorRole[];
}

export interface UpdateCreatorProfileRequest {
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  specialties: CreatorSpecialty[];
}

export type CreatorProductionPage = PageResponse<ProductionSummary>;
export type CreatorParticipationPage = PageResponse<CreatorParticipation>;

export const CREATOR_SPECIALTY_OPTIONS: readonly { value: CreatorSpecialty; label: string }[] = [
  { value: 'DIRECTING', label: 'Dirección' },
  { value: 'SCREENWRITING', label: 'Guion' },
  { value: 'PRODUCING', label: 'Producción' },
  { value: 'CINEMATOGRAPHY', label: 'Dirección de fotografía' },
  { value: 'CAMERA', label: 'Cámara' },
  { value: 'EDITING', label: 'Edición' },
  { value: 'COLOR', label: 'Color' },
  { value: 'SOUND', label: 'Sonido' },
  { value: 'MUSIC', label: 'Música' },
  { value: 'ART_DIRECTION', label: 'Arte' },
  { value: 'PRODUCTION_DESIGN', label: 'Diseño de producción' },
  { value: 'VFX', label: 'VFX' },
  { value: 'ANIMATION', label: 'Animación' },
  { value: 'ACTING', label: 'Actuación' }
];
