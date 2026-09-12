import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';

@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.html',
  styleUrl: './avatar.scss',
  host: {
    '[style.--avatar-size.px]': 'size()'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Avatar {

  readonly name = input.required<string>();
  readonly imageUrl = input<string | null>(null);
  readonly focalX = input(0.5);
  readonly focalY = input(0.5);
  readonly size = input(36);

  readonly imageFailed = signal(false);

  readonly initials = computed(() => this.name()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join(''));

  readonly objectPosition = computed(() =>
    `${this.focalX() * 100}% ${this.focalY() * 100}%`
  );

  constructor() {
    effect(() => {
      this.imageUrl();
      this.imageFailed.set(false);
    });
  }
}