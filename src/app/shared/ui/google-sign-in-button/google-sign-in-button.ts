import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  NgZone,
  output,
  viewChild,
} from '@angular/core';

import { GoogleIdentityService } from '../../../core/auth/google-identity.service';

@Component({
  selector: 'app-google-sign-in-button',
  template: `
    <div class="google-button-shell" [class.disabled]="disabled()">
      <div class="google-button-crop">
        <div #buttonHost class="google-button-host"></div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .google-button-shell {
      width: 100%;
      height: 48px;

      padding: 3px;

      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);

      background: var(--color-surface-1);

      display: flex;
      align-items: center;
      justify-content: center;

      overflow: hidden;
      cursor: pointer;
    }

    .google-button-crop {
      width: 100%;
      height: 40px;

      border-radius: calc(var(--radius-md) - 3px);
      overflow: hidden;

      display: flex;
      align-items: center;
      justify-content: center;

      background: #202124;
    }

    .google-button-host {
      width: calc(100% + 8px);
      height: 46px;

      margin: -3px -4px;

      display: flex;
      align-items: center;
      justify-content: center;
    }

    .google-button-shell.disabled {
      opacity: 0.55;
      pointer-events: none;
      cursor: default;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoogleSignInButton implements AfterViewInit {
  private readonly googleIdentity = inject(GoogleIdentityService);
  private readonly zone = inject(NgZone);

  private readonly buttonHost =
    viewChild.required<ElementRef<HTMLElement>>('buttonHost');

  readonly disabled = input(false);
  readonly credential = output<string>();

  ngAfterViewInit(): void {
    void this.googleIdentity
      .renderButton(this.buttonHost().nativeElement, (credential) => {
        this.zone.run(() => this.credential.emit(credential));
      })
      .catch(() => {
        // El formulario tradicional sigue disponible si GIS no carga.
      });
  }
}
