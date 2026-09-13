import { Injectable } from '@angular/core';

import { GOOGLE_CLIENT_ID } from '../config/google-auth.config';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  ux_mode?: 'popup' | 'redirect';
  auto_select?: boolean;
  use_fedcm_for_button?: boolean;
}

interface GoogleButtonConfiguration {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black' | 'outline_dark';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: string;
  locale?: string;
}

interface GoogleAccountsId {
  initialize(configuration: GoogleIdConfiguration): void;

  renderButton(
    parent: HTMLElement,
    configuration: GoogleButtonConfiguration,
  ): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleAccountsId;
      };
    };
  }
}

@Injectable({ providedIn: 'root' })
export class GoogleIdentityService {
  private loadPromise: Promise<GoogleAccountsId> | null = null;
  private initialized = false;
  private credentialHandler: ((credential: string) => void) | null = null;

  async renderButton(
    container: HTMLElement,
    onCredential: (credential: string) => void,
  ): Promise<void> {
    const google = await this.load();

    this.credentialHandler = onCredential;

    if (!this.initialized) {
      google.initialize({
        client_id: GOOGLE_CLIENT_ID,
        ux_mode: 'popup',
        auto_select: false,
        use_fedcm_for_button: false,
        callback: (response) => {
          if (response.credential) {
            this.credentialHandler?.(response.credential);
          }
        },
      });

      this.initialized = true;
    }

    container.replaceChildren();

    const availableWidth = Math.min(
      400,
      Math.floor(container.getBoundingClientRect().width),
    );

    google.renderButton(container, {
      type: 'standard',
      theme: 'outline_dark',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: String(availableWidth),
    });
  }

  private load(): Promise<GoogleAccountsId> {
    if (window.google?.accounts?.id) {
      return Promise.resolve(window.google.accounts.id);
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = new Promise<GoogleAccountsId>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-google-identity]',
      );

      const resolveGoogle = (): void => {
        if (!window.google?.accounts?.id) {
          reject(new Error('Google Identity Services is unavailable'));
          return;
        }

        resolve(window.google.accounts.id);
      };

      if (existing) {
        existing.addEventListener('load', resolveGoogle, { once: true });
        existing.addEventListener(
          'error',
          () => reject(new Error('Unable to load Google Identity Services')),
          { once: true },
        );
        return;
      }

      const script = document.createElement('script');

      script.src = 'https://accounts.google.com/gsi/client?hl=es';
      script.async = true;
      script.defer = true;
      script.dataset['googleIdentity'] = 'true';

      script.addEventListener('load', resolveGoogle, { once: true });
      script.addEventListener(
        'error',
        () => reject(new Error('Unable to load Google Identity Services')),
        { once: true },
      );

      document.head.appendChild(script);
    });

    return this.loadPromise;
  }
}
