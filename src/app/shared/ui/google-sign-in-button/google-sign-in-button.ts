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
      <div #buttonHost class="google-button-host"></div>
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
      padding: 4px;
      box-sizing: border-box;

      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      background: #202124;

      display: flex;
      align-items: center;
      justify-content: center;

      overflow: hidden;
    }

    .google-button-host {
      width: 100%;
      height: 100%;

      position: relative;

      border-radius: 999px;
      background: #202124;
      overflow: hidden;

      display: flex;
      align-items: center;
      justify-content: center;
    }

    .google-button-host::after {
      content: '';

      position: absolute;
      inset: 0;
      z-index: 2;

      border-radius: 999px;
      box-shadow: inset 0 0 0 2px #202124;

      pointer-events: none;
    }

    .google-button-shell.disabled {
      opacity: 0.55;
      pointer-events: none;
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
