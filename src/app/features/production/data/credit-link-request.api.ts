import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../../../core/config/api.config';
import {
  CreateProductionCreditClaimRequest,
  CreditLinkRequestPage,
  CreditLinkRequestStatus,
  ProductionCreditLinkRequest,
} from './credit-link-request.models';

@Injectable({ providedIn: 'root' })
export class CreditLinkRequestApi {
  private readonly http = inject(HttpClient);

  findForProduction(
    slug: string,
    status: CreditLinkRequestStatus = 'PENDING',
  ): Observable<ProductionCreditLinkRequest[]> {
    const params = new HttpParams().set('status', status);

    return this.http.get<ProductionCreditLinkRequest[]>(
      `${API_URL}/productions/${slug}/credit-link-requests/me`,
      { params },
    );
  }

  claimExistingCredit(
    slug: string,
    creditId: number,
  ): Observable<ProductionCreditLinkRequest> {
    return this.http.post<ProductionCreditLinkRequest>(
      `${API_URL}/productions/${slug}/credits/${creditId}/claims`,
      {},
    );
  }

  claimNewCredit(
    slug: string,
    request: CreateProductionCreditClaimRequest,
  ): Observable<ProductionCreditLinkRequest> {
    return this.http.post<ProductionCreditLinkRequest>(
      `${API_URL}/productions/${slug}/credit-claims`,
      request,
    );
  }

  findReceived(
    status?: CreditLinkRequestStatus | null,
    page = 0,
    size = 20,
  ): Observable<CreditLinkRequestPage> {
    let params = new HttpParams().set('page', page).set('size', size);

    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<CreditLinkRequestPage>(
      `${API_URL}/credit-link-requests/received`,
      { params },
    );
  }

  findSent(
    status?: CreditLinkRequestStatus | null,
    page = 0,
    size = 20,
  ): Observable<CreditLinkRequestPage> {
    let params = new HttpParams().set('page', page).set('size', size);

    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<CreditLinkRequestPage>(
      `${API_URL}/credit-link-requests/sent`,
      { params },
    );
  }

  accept(requestId: number): Observable<ProductionCreditLinkRequest> {
    return this.http.put<ProductionCreditLinkRequest>(
      `${API_URL}/credit-link-requests/${requestId}/accept`,
      {},
    );
  }

  reject(requestId: number): Observable<ProductionCreditLinkRequest> {
    return this.http.put<ProductionCreditLinkRequest>(
      `${API_URL}/credit-link-requests/${requestId}/reject`,
      {},
    );
  }

  cancel(requestId: number): Observable<ProductionCreditLinkRequest> {
    return this.http.put<ProductionCreditLinkRequest>(
      `${API_URL}/credit-link-requests/${requestId}/cancel`,
      {},
    );
  }
}
