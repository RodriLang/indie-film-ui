import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_URL } from '../../../core/config/api.config';
import {
  CreateProductionRequest,
  CreateProductionVideoRequest,
  Genre,
  OwnProductionPage,
  Production,
  ProductionLikeResponse,
  ProductionPage,
  ProductionStatus,
  ProductionType,
  ProductionVideoPlayback,
  UpdateProductionArtworkRequest,
  UpdateProductionRequest,
  UpdateProductionVideoRequest,
} from './production.models';

@Injectable({ providedIn: 'root' })
export class ProductionApi {
  private readonly http = inject(HttpClient);

  findPublished(
    query = '',
    type?: ProductionType | null,
    releaseYear?: number | null,
    page = 0,
    size = 20,
  ): Observable<ProductionPage> {
    let params = new HttpParams()
      .set('q', query)
      .set('page', page)
      .set('size', size);

    if (type) {
      params = params.set('type', type);
    }

    if (releaseYear) {
      params = params.set('releaseYear', releaseYear);
    }

    return this.http.get<ProductionPage>(`${API_URL}/productions`, { params });
  }

  findPublishedBySlug(slug: string): Observable<Production> {
    return this.http.get<Production>(`${API_URL}/productions/${slug}`);
  }

  getPlayback(
    slug: string,
    videoId: number,
  ): Observable<ProductionVideoPlayback> {
    return this.http.get<ProductionVideoPlayback>(
      `${API_URL}/productions/${slug}/videos/${videoId}/playback`,
    );
  }

  findOwn(
    status?: ProductionStatus | null,
    page = 0,
    size = 20,
  ): Observable<OwnProductionPage> {
    let params = new HttpParams().set('page', page).set('size', size);

    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<OwnProductionPage>(`${API_URL}/productions/me`, {
      params,
    });
  }

  findOwnBySlug(slug: string): Observable<Production> {
    return this.http.get<Production>(`${API_URL}/productions/me/${slug}`);
  }

  findGenres(): Observable<Genre[]> {
    return this.http.get<Genre[]>(`${API_URL}/genres`);
  }

  create(request: CreateProductionRequest): Observable<Production> {
    return this.http.post<Production>(`${API_URL}/productions`, request);
  }

  update(
    slug: string,
    request: UpdateProductionRequest,
  ): Observable<Production> {
    return this.http.patch<Production>(
      `${API_URL}/productions/${slug}`,
      request,
    );
  }

  updateArtwork(
    slug: string,
    request: UpdateProductionArtworkRequest,
  ): Observable<Production> {
    return this.http.put<Production>(
      `${API_URL}/productions/${slug}/artwork`,
      request,
    );
  }

  addVideo(
    slug: string,
    request: CreateProductionVideoRequest,
  ): Observable<Production> {
    return this.http.post<Production>(
      `${API_URL}/productions/${slug}/videos`,
      request,
    );
  }

  updateVideo(
    slug: string,
    videoId: number,
    request: UpdateProductionVideoRequest,
  ): Observable<Production> {
    return this.http.patch<Production>(
      `${API_URL}/productions/${slug}/videos/${videoId}`,
      request,
    );
  }

  removeVideo(slug: string, videoId: number): Observable<void> {
    return this.http.delete<void>(
      `${API_URL}/productions/${slug}/videos/${videoId}`,
    );
  }

  submitForReview(slug: string): Observable<Production> {
    return this.http.put<Production>(
      `${API_URL}/productions/${slug}/submit-review`,
      {},
    );
  }

  withdrawFromReview(slug: string): Observable<Production> {
    return this.http.put<Production>(
      `${API_URL}/productions/${slug}/withdraw-review`,
      {},
    );
  }

  restorePublication(slug: string): Observable<Production> {
    return this.http.put<Production>(
      `${API_URL}/productions/${slug}/restore`,
      {},
    );
  }

  hide(slug: string): Observable<Production> {
    return this.http.put<Production>(`${API_URL}/productions/${slug}/hide`, {});
  }

  remove(slug: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/productions/${slug}`);
  }

  like(slug: string): Observable<ProductionLikeResponse> {
    return this.http.put<ProductionLikeResponse>(
      `${API_URL}/productions/${slug}/like`,
      {},
    );
  }

  unlike(slug: string): Observable<ProductionLikeResponse> {
    return this.http.delete<ProductionLikeResponse>(
      `${API_URL}/productions/${slug}/like`,
    );
  }
}
