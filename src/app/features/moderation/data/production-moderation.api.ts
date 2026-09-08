import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import {
  normalizePageResponse,
  PageResponse,
  SpringPageResponse,
} from '../../../core/api/api.models';
import { API_URL } from '../../../core/config/api.config';
import {
  Production,
  ProductionModerationStatus,
} from '../../production/data/production.models';
import {
  ApproveProductionRequest,
  ModerationProductionSummary,
  ProductionModerationReview,
  RejectProductionRequest,
} from './production-moderation.models';

@Injectable({ providedIn: 'root' })
export class ProductionModerationApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_URL}/admin/moderation/productions`;

  findAll(
    moderationStatus: Exclude<
      ProductionModerationStatus,
      'NOT_SUBMITTED'
    > = 'PENDING',
    page = 0,
    size = 20,
  ): Observable<PageResponse<ModerationProductionSummary>> {
    const params = new HttpParams()
      .set('moderationStatus', moderationStatus)
      .set('page', page)
      .set('size', size);

    return this.http
      .get<
        | PageResponse<ModerationProductionSummary>
        | SpringPageResponse<ModerationProductionSummary>
      >(this.baseUrl, { params })
      .pipe(map((page) => normalizePageResponse(page)));
  }

  findBySlug(slug: string): Observable<Production> {
    return this.http.get<Production>(`${this.baseUrl}/${slug}`);
  }

  findReviews(slug: string): Observable<ProductionModerationReview[]> {
    return this.http.get<ProductionModerationReview[]>(
      `${this.baseUrl}/${slug}/reviews`,
    );
  }

  approve(
    slug: string,
    request: ApproveProductionRequest,
  ): Observable<Production> {
    return this.http.put<Production>(
      `${this.baseUrl}/${slug}/approve`,
      request,
    );
  }

  reject(
    slug: string,
    request: RejectProductionRequest,
  ): Observable<Production> {
    return this.http.put<Production>(`${this.baseUrl}/${slug}/reject`, request);
  }
}
