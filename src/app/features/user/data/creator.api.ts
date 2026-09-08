import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_URL } from '../../../core/config/api.config';
import {
  CreatorParticipationPage,
  CreatorProductionPage,
  CreatorProfile,
  UpdateCreatorProfileRequest
} from './creator.models';

@Injectable({ providedIn: 'root' })
export class CreatorApi {
  private readonly http = inject(HttpClient);

  findByUsername(username: string): Observable<CreatorProfile> {
    return this.http.get<CreatorProfile>(`${API_URL}/creators/${username}`);
  }

  findProductions(username: string, page = 0, size = 20): Observable<CreatorProductionPage> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<CreatorProductionPage>(`${API_URL}/creators/${username}/productions`, { params });
  }

  findParticipations(username: string, page = 0, size = 20): Observable<CreatorParticipationPage> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<CreatorParticipationPage>(`${API_URL}/creators/${username}/participations`, { params });
  }

  updateMe(request: UpdateCreatorProfileRequest): Observable<CreatorProfile> {
    return this.http.patch<CreatorProfile>(`${API_URL}/creators/me`, request);
  }
}
