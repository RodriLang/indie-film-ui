import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../../../core/config/api.config';
import {
  ProductionProgress,
  UpdateVideoProgressRequest,
  VideoProgress,
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
}
