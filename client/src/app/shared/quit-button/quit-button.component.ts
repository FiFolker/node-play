/**
 * Composant réutilisable pour le bouton quitter avec confirmation
 */
import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-quit-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .btn-quit {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.6rem 1rem;
      border: 1px solid rgba(239, 68, 68, 0.4);
      background: rgba(239, 68, 68, 0.1);
      color: var(--danger, #ef4444);
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-quit:hover {
      background: var(--danger, #ef4444);
      color: white;
      border-color: var(--danger, #ef4444);
    }

    .btn-quit:focus-visible {
      outline: 2px solid var(--danger, #ef4444);
      outline-offset: 2px;
    }

    .btn-quit.compact {
      padding: 0.5rem;
      border-radius: 6px;
    }

    .btn-quit.compact .label {
      display: none;
    }

    svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    /* Modal Confirmation - Must escape parent stacking context */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999; /* Very high to escape any stacking context */
      animation: fadeIn 0.2s ease-out;
    }

    .modal-box {
      background: var(--bg-card, #1e293b);
      border: 1px solid var(--border-color, rgba(255,255,255,0.1));
      padding: 2rem;
      border-radius: 16px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      max-width: 380px;
      width: 90%;
      color: var(--text-primary, #f8fafc);
    }

    .modal-box h3 {
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0 0 0.75rem 0;
      color: var(--text-primary, #f8fafc);
    }

    .modal-box p {
      color: var(--text-secondary, #cbd5e1);
      margin: 0 0 1.5rem 0;
      font-size: 0.95rem;
    }

    .modal-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
    }

    .btn-action {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      border: none;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-stay {
      background: var(--bg-tertiary, #334155);
      color: var(--text-primary, #f8fafc);
    }

    .btn-stay:hover {
      background: var(--bg-secondary, #1e293b);
    }

    .btn-leave {
      background: var(--danger, #ef4444);
      color: white;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }

    .btn-leave:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,
  template: `
    <button 
      class="btn-quit" 
      [class.compact]="compact()"
      (click)="showConfirm.set(true)"
      type="button"
      [attr.aria-label]="label()"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
      </svg>
      <span class="label">{{ label() }}</span>
    </button>

    @if (showConfirm()) {
      <div class="modal-overlay" (click)="showConfirm.set(false)">
        <div class="modal-box" (click)="$event.stopPropagation()">
          <h3>{{ confirmTitle() }}</h3>
          <p>{{ confirmMessage() }}</p>
          <div class="modal-actions">
            <button class="btn-action btn-stay" (click)="showConfirm.set(false)">
              {{ cancelLabel() }}
            </button>
            <button class="btn-action btn-leave" (click)="onConfirm()">
              {{ confirmLabel() }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class QuitButtonComponent {
  // Inputs
  label = input('Quitter');
  compact = input(false);
  confirmTitle = input('Quitter ?');
  confirmMessage = input('La partie continuera sans vous.');
  cancelLabel = input('Rester');
  confirmLabel = input('Partir');

  // Output
  confirmed = output<void>();

  // State
  showConfirm = signal(false);

  onConfirm(): void {
    this.showConfirm.set(false);
    this.confirmed.emit();
  }
}
