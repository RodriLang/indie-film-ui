import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../../../core/config/api.config';
import {
  ContinueWatchingPage,
  ProductionProgress,
  UpdateVideoProgressRequest,
  VideoProgress,
  WatchHistoryPage,
} from './viewing-progress.models';

@Injectable({ providedIn: 'root' })
export class ViewingProgressApi {
  private readonly http = inject(HttpClient);

  findProductionProgress(slug: string): Observable<ProductionProgress> {
    return this.http.get<ProductionProgress>(
      `${API_URL}/me/productions/${slug}/progress`,
    );
  }

  updateVideoProgress(
    videoId: number,
    request: UpdateVideoProgressRequest,
  ): Observable<VideoProgress> {
    return this.http.put<VideoProgress>(
      `${API_URL}/me/video-progress/${videoId}`,
      request,
    );
  }

  findContinueWatching(page = 0, size = 12): Observable<ContinueWatchingPage> {
    const params = new HttpParams().set('page', page).set('size', size);

    return this.http.get<ContinueWatchingPage>(
      `${API_URL}/me/continue-watching`,
      { params },
    );
  }

  findWatchHistory(page = 0, size = 20): Observable<WatchHistoryPage> {
    const params = new HttpParams().set('page', page).set('size', size);

    return this.http.get<WatchHistoryPage>(`${API_URL}/me/watch-history`, {
      params,
    });
  }

  markVideoAsWatched(videoId: number): Observable<VideoProgress> {
    return this.http.post<VideoProgress>(
      `${API_URL}/me/video-progress/${videoId}/complete`,
      null,
    );
  }

  deleteProductionProgress(slug: string): Observable<void> {
    return this.http.delete<void>(
      `${API_URL}/me/productions/${slug}/viewing-progress`,
    );
  }
}
