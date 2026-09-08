import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { LucidePlay } from '@lucide/angular';

import { ProductionVideo } from '../../data/production.models';

@Component({
  selector: 'app-episode-card',
  imports: [LucidePlay],
  templateUrl: './episode-card.html',
  styleUrl: './episode-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EpisodeCard {
  readonly episode = input.required<ProductionVideo>();
  readonly active = input(false);
  readonly selected = output<ProductionVideo>();
  readonly imageFailed = signal(false);

  readonly label = computed(() => {
    const episode = this.episode();
    return episode.title || (episode.episodeNumber ? `Episodio ${episode.episodeNumber}` : 'Video');
  });

  select(): void {
    this.selected.emit(this.episode());
  }
}
