/**
 * Lobby - Salle d'attente avant le début du jeu
 */

import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { Router } from '@angular/router';
import { SocketService } from '../../services/socket.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-lobby',
  standalone: true,
  template: `
    <div class="lobby-container">
      <header class="lobby-header glass">
        <button class="btn btn-secondary" (click)="leaveRoom()">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Quitter
        </button>
        <div class="header-center">
          <h1>{{ socketService.currentRoom()?.name }}</h1>
        </div>
        <button class="btn btn-icon btn-secondary" (click)="themeService.toggle()">
          @if (themeService.theme() === 'dark') {
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          }
        </button>
      </header>

      <main class="lobby-main container">
        <!-- Info partie privée -->
        @if (socketService.currentRoom()?.isPrivate) {
          <div class="private-code-banner card animate-fadeIn">
            <div class="code-info">
              <span class="code-label">Code de la partie:</span>
              <span class="code-value">{{ socketService.currentRoom()?.privateCode }}</span>
            </div>
            <button class="btn btn-secondary" (click)="copyCode()">
              @if (codeCopied()) {
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                Copié !
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copier
              }
            </button>
          </div>
        }

        <div class="lobby-content">
          <!-- Liste des joueurs -->
          <section class="players-section card animate-slideUp">
            <h2>
              Joueurs 
              <span class="player-count">({{ socketService.currentRoom()?.players?.length }}/{{ socketService.currentRoom()?.maxPlayers }})</span>
            </h2>

            <div class="players-list">
              @for (player of socketService.currentRoom()?.players; track player.id) {
                <div class="player-item" [class.is-host]="player.isHost" [class.is-ready]="player.isReady">
                  <div class="player-avatar">
                    @if (player.isHost) {
                      👑
                    } @else {
                      👤
                    }
                  </div>
                  <div class="player-info">
                    <span class="player-name">{{ player.username }}</span>
                    @if (player.isHost) {
                      <span class="badge badge-warning">Hôte</span>
                    }
                  </div>
                  <div class="player-status">
                    @if (player.isHost) {
                      <span class="status-text">-</span>
                    } @else if (player.isReady) {
                      <span class="badge badge-success">Prêt</span>
                    } @else {
                      <span class="badge badge-danger">En attente</span>
                    }
                  </div>
                </div>
              }
            </div>
          </section>

          <!-- Règles du jeu -->
          <section class="rules-section card animate-slideUp" style="animation-delay: 0.1s">
            <h2>Règles Skyjo</h2>
            <div class="rules-content">
              <div class="rule">
                <span class="rule-icon">🎯</span>
                <div>
                  <strong>Objectif</strong>
                  <p>Avoir le moins de points possible</p>
                </div>
              </div>
              <div class="rule">
                <span class="rule-icon">🃏</span>
                <div>
                  <strong>Cartes</strong>
                  <p>Valeurs de -2 à +12</p>
                </div>
              </div>
              <div class="rule">
                <span class="rule-icon">🔄</span>
                <div>
                  <strong>Tour</strong>
                  <p>Piochez puis échangez ou révélez</p>
                </div>
              </div>
              <div class="rule">
                <span class="rule-icon">✨</span>
                <div>
                  <strong>Bonus</strong>
                  <p>3 cartes identiques en colonne = disparition !</p>
                </div>
              </div>
              <div class="rule">
                <span class="rule-icon">🏁</span>
                <div>
                  <strong>Fin</strong>
                  <p>Premier à 100 points perd</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- Actions -->
        <div class="lobby-actions animate-slideUp" style="animation-delay: 0.2s">
          @if (socketService.isHost()) {
            <button 
              class="btn btn-primary btn-large"
              [disabled]="!canStart()"
              (click)="startGame()"
            >
              @if (canStart()) {
                Lancer la partie
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              } @else {
                En attente des joueurs...
              }
            </button>
          } @else {
            <button 
              class="btn btn-large"
              [class.btn-primary]="!isReady()"
              [class.btn-success]="isReady()"
              (click)="toggleReady()"
            >
              @if (isReady()) {
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                Prêt !
              } @else {
                Cliquez quand vous êtes prêt
              }
            </button>
          }
        </div>
      </main>

      @if (socketService.error()) {
        <div class="toast toast-error animate-slideUp">
          {{ socketService.error() }}
          <button class="toast-close" (click)="socketService.clearError()">×</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .lobby-container {
      min-height: 100vh;
      padding-bottom: 120px;
    }

    .lobby-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 2rem;
      margin: 1rem;
      border-radius: 1rem;
    }

    .header-center h1 {
      font-size: 1.25rem;
      background: var(--gradient-primary);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .lobby-main {
      padding-top: 1rem;
    }

    .private-code-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      margin-bottom: 1.5rem;
      background: rgba(99, 102, 241, 0.1);
      border-color: var(--primary);
    }

    .code-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .code-label {
      color: var(--text-secondary);
    }

    .code-value {
      font-size: 1.5rem;
      font-weight: 700;
      font-family: monospace;
      letter-spacing: 0.1em;
      color: var(--primary);
    }

    .lobby-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }

    @media (max-width: 768px) {
      .lobby-content {
        grid-template-columns: 1fr;
      }
    }

    .players-section h2,
    .rules-section h2 {
      font-size: 1.125rem;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .player-count {
      color: var(--text-muted);
      font-weight: 400;
    }

    .players-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .player-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: var(--bg-tertiary);
      border-radius: 0.75rem;
      transition: all 0.2s ease;
    }

    .player-item.is-host {
      background: rgba(245, 158, 11, 0.1);
    }

    .player-item.is-ready:not(.is-host) {
      background: rgba(16, 185, 129, 0.1);
    }

    .player-avatar {
      font-size: 1.5rem;
    }

    .player-info {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .player-name {
      font-weight: 500;
    }

    .rules-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .rule {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
    }

    .rule-icon {
      font-size: 1.5rem;
    }

    .rule strong {
      display: block;
      margin-bottom: 0.25rem;
    }

    .rule p {
      font-size: 0.875rem;
      color: var(--text-secondary);
    }

    .lobby-actions {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 1.5rem;
      background: var(--bg-glass);
      backdrop-filter: blur(16px);
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: center;
    }

    .btn-large {
      padding: 1rem 3rem;
      font-size: 1.125rem;
    }

    .toast {
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      padding: 1rem 2rem;
      border-radius: 0.75rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      z-index: 1001;
    }

    .toast-error {
      background: var(--danger);
      color: white;
    }

    .toast-close {
      background: none;
      border: none;
      color: white;
      font-size: 1.5rem;
      cursor: pointer;
    }
  `]
})
export class LobbyComponent implements OnInit {
  socketService = inject(SocketService);
  themeService = inject(ThemeService);
  private router = inject(Router);

  codeCopied = signal(false);

  ngOnInit(): void {
    // Vérifier que le joueur est dans une room
    if (!this.socketService.currentRoom()) {
      this.router.navigate(['/hub']);
      return;
    }

    // Surveiller le passage en mode jeu
    const checkGameStart = setInterval(() => {
      const gameState = this.socketService.gameState();
      if (gameState) {
        clearInterval(checkGameStart);
        this.router.navigate(['/skyjo']);
      }
    }, 100);
  }

  isReady(): boolean {
    const room = this.socketService.currentRoom();
    const player = this.socketService.currentPlayer();
    if (!room || !player) return false;

    const roomPlayer = room.players.find(p => p.id === player.id);
    return roomPlayer?.isReady || false;
  }

  canStart(): boolean {
    const room = this.socketService.currentRoom();
    if (!room) return false;

    // Au moins 2 joueurs
    if (room.players.length < 2) return false;

    // Tous les non-hôtes doivent être prêts
    return room.players
      .filter(p => !p.isHost)
      .every(p => p.isReady);
  }

  toggleReady(): void {
    this.socketService.toggleReady();
  }

  startGame(): void {
    this.socketService.startGame();
  }

  leaveRoom(): void {
    this.socketService.leaveRoom();
    this.router.navigate(['/hub']);
  }

  async copyCode(): Promise<void> {
    const code = this.socketService.currentRoom()?.privateCode;
    if (!code) return;

    try {
      // Méthode moderne
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback pour les navigateurs plus anciens
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      this.codeCopied.set(true);
      setTimeout(() => this.codeCopied.set(false), 2000);
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
      // Afficher le code dans une alerte comme fallback ultime
      alert(`Code de la partie: ${code}`);
    }
  }
}
