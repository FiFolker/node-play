/**
 * Composant réutilisable pour le toggle thème jour/nuit
 */
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

@Component({
    selector: 'app-theme-toggle',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'theme-toggle'
    },
    styles: `
    :host {
      display: inline-flex;
    }

    .toggle-btn {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      cursor: pointer;
      color: var(--text-secondary);
      opacity: 0.9;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      border-radius: 50%;
      width: 40px;
      height: 40px;
    }

    .toggle-btn:hover {
      opacity: 1;
      background: var(--bg-secondary);
      color: var(--text-primary);
      border-color: var(--primary);
      transform: scale(1.05);
    }

    .toggle-btn:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }

    svg {
      width: 20px;
      height: 20px;
    }
  `,
    template: `
    <button 
      class="toggle-btn" 
      (click)="themeService.toggle()" 
      [attr.aria-label]="themeService.theme() === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'"
      type="button"
    >
      @if (themeService.theme() === 'dark') {
        <!-- Sun Icon -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      } @else {
        <!-- Moon Icon -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      }
    </button>
  `
})
export class ThemeToggleComponent {
    themeService = inject(ThemeService);
}
