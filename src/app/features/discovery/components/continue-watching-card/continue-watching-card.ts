import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { ContinueWatching } from '../../../production/data/viewing-progress.models';

@Component({
  selector: 'app-continue-watching-card',
  imports: [RouterLink],
  templateUrl: './continue-watching-card.html',
  styleUrl: './continue-watching-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContinueWatchingCard {
  readonly item = input.required<ContinueWatching>();
  readonly busy = input(false);

  readonly markWatched = output<ContinueWatching>();
  readonly deleteActivity = output<ContinueWatching>();

  readonly menuOpen = signal(false);

  imageUrl(): string | null {
    return this.item().posterUrl || this.item().thumbnailUrl || null;
  }

  subtitle(): string {
    const item = this.item();

    if (item.structure === 'EPISODIC') {
      const episode = item.episodeNumber
        ? `Episodio ${item.episodeNumber}`
        : 'Episodio';

      if (item.resumeType === 'NEXT_EPISODE') {
        return episode;
      }

      return `${episode} · ${item.progressPercent} % visto`;
    }

    return `${item.progressPercent} % visto`;
  }

  showProgress(): boolean {
    return this.item().resumeType === 'RESUME_VIDEO';
  }

  isNextEpisode(): boolean {
    return this.item().resumeType === 'NEXT_EPISODE';
  }

  canMarkWatched(): boolean {
    return this.item().resumeType === 'RESUME_VIDEO';
  }

  toggleMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    this.menuOpen.update((open) => !open);
  }

  markAsWatched(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.canMarkWatched() || this.busy()) {
      return;
    }

    this.menuOpen.set(false);
    this.markWatched.emit(this.item());
  }

  removeActivity(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.busy()) {
      return;
    }

    this.menuOpen.set(false);
    this.deleteActivity.emit(this.item());
  }
}
