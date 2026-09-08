import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-media-rail-item',
  template: '<ng-content />',
  styleUrl: './media-rail-item.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MediaRailItem {
}
