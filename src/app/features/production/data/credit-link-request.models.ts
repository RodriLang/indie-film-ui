import { PageResponse } from '../../../core/api/api.models';
import { CreditRole } from './production.models';

export type CreditLinkRequestType = 'OWNER_INVITATION' | 'USER_CLAIM';
export type CreditLinkRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export interface CreditLinkRequestProduction {
  id: number;
  slug: string;
  title: string;
}

export interface CreditLinkRequestCredit {
  id: number;
  personName: string;
  role: CreditRole;
  roleDetail?: string | null;
  displayOrder: number;
}

export interface CreditLinkRequestProposedCredit {
  personName: string;
  role: CreditRole;
  roleDetail?: string | null;
}

export interface CreditLinkRequestUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface ProductionCreditLinkRequest {
  id: number;
  type: CreditLinkRequestType;
  status: CreditLinkRequestStatus;
  production: CreditLinkRequestProduction;
  credit?: CreditLinkRequestCredit | null;
  proposedCredit?: CreditLinkRequestProposedCredit | null;
  requestedUser: CreditLinkRequestUser;
  requestedBy: CreditLinkRequestUser;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface CreateProductionCreditClaimRequest {
  personName: string;
  role: CreditRole;
  roleDetail?: string | null;
}

export type CreditLinkRequestPage = PageResponse<ProductionCreditLinkRequest>;
