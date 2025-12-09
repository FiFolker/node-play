/**
 * Hub principal - Liste des jeux et parties disponibles
 */

import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { SocketService } from '../../services/socket.service';
import { ThemeService } from '../../services/theme.service';
import type { GameType } from '../../types';

@Component({
  selector: 'app-hub',
  standalone: true,
  template: `
    <div class="hub-container">
      <!-- Header -->
      <header class="hub-header glass">
        <div class="header-left">
          <span class="logo">🎮</span>
          <h1 class="title">Node Play</h1>
        </div>
        <div class="header-right">
          <span class="player-info">
            <span class="player-avatar">👤</span>
            {{ socketService.currentPlayer()?.username }}
          </span>
          <button class="btn btn-icon btn-secondary" (click)="themeService.toggle()">
            @if (themeService.theme() === 'dark') {
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
        </div>
      </header>

      <main class="hub-main container">
        <!-- Section: Créer une partie -->
        <section class="section animate-slideUp">
          <div class="section-header">
            <h2>Créer une partie</h2>
          </div>
          
          <div class="games-grid">
            <!-- Carte Skyjo -->
            <div class="game-card card" (click)="openCreateModal('skyjo')">
              <div class="game-icon">🃏</div>
              <h3 class="game-title">Skyjo</h3>
              <p class="game-description">Jeu de cartes stratégique. Collectez le moins de points possible !</p>
              <div class="game-info">
                <span class="badge badge-success">2-8 joueurs</span>
              </div>
            </div>

            <!-- Placeholder pour futurs jeux -->
            <div class="game-card card game-card-coming">
              <div class="game-icon">🎲</div>
              <h3 class="game-title">Bientôt...</h3>
              <p class="game-description">D'autres jeux arrivent prochainement !</p>
            </div>
          </div>
        </section>

        <!-- Section: Parties publiques -->
        <section class="section animate-slideUp" style="animation-delay: 0.1s">
          <div class="section-header">
            <h2>Parties publiques</h2>
            <button class="btn btn-secondary" (click)="refreshRooms()">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              Actualiser
            </button>
          </div>

          @if (socketService.publicRooms().length === 0) {
            <div class="empty-state card">
              <div class="empty-icon">🔍</div>
              <p>Aucune partie publique en cours</p>
              <p class="text-muted">Créez-en une ou rejoignez avec un code !</p>
            </div>
          } @else {
            <div class="rooms-list">
              @for (room of socketService.publicRooms(); track room.id) {
                <div class="room-card card" (click)="joinRoom(room.id)">
                  <div class="room-info">
                    <h4>{{ room.name }}</h4>
                    <p class="room-game">{{ getGameName(room.gameType) }}</p>
                  </div>
                  <div class="room-meta">
                    <span class="room-players">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      {{ room.players.length }}/{{ room.maxPlayers }}
                    </span>
                    <button class="btn btn-primary">Rejoindre</button>
                  </div>
                </div>
              }
            </div>
          }
        </section>

        <!-- Section: Rejoindre avec code -->
        <section class="section animate-slideUp" style="animation-delay: 0.2s">
          <div class="section-header">
            <h2>Rejoindre une partie privée</h2>
          </div>
          
          <form class="join-form card" (submit)="joinPrivateRoom($event)">
            <input 
              type="text" 
              class="input"
              placeholder="Entrez le code de la partie..."
              [value]="privateCode()"
              (input)="onCodeChange($event)"
              maxlength="10"
            />
            <button type="submit" class="btn btn-primary" [disabled]="!privateCode()">
              Rejoindre
            </button>
          </form>
        </section>
      </main>

      <!-- Modal de création -->
      @if (showCreateModal()) {
        <div class="modal-overlay" (click)="closeCreateModal()">
          <div class="modal card animate-scaleIn" (click)="$event.stopPropagation()">
            <h3 class="modal-title">Créer une partie {{ getGameName(selectedGame()!) }}</h3>
            
            <form (submit)="createRoom($event)">
              <div class="form-group">
                <label class="form-label">Nom de la partie</label>
                <input 
                  type="text" 
                  class="input"
                  placeholder="Ma super partie..."
                  [value]="roomName()"
                  (input)="onRoomNameChange($event)"
                  maxlength="30"
                />
              </div>

              <div class="form-group">
                <label class="form-label">Visibilité</label>
                <div class="visibility-options">
                  <button 
                    type="button"
                    class="visibility-option"
                    [class.active]="!isPrivate()"
                    (click)="isPrivate.set(false)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    <span>Publique</span>
                    <small>Visible par tous</small>
                  </button>
                  <button 
                    type="button"
                    class="visibility-option"
                    [class.active]="isPrivate()"
                    (click)="isPrivate.set(true)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span>Privée</span>
                    <small>Avec code secret</small>
                  </button>
                </div>
              </div>

              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" (click)="closeCreateModal()">
                  Annuler
                </button>
                <button type="submit" class="btn btn-primary">
                  Créer la partie
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      @if (socketService.error()) {
        <div class="toast toast-error animate-slideUp">
          {{ socketService.error() }}
          <button class="toast-close" (click)="socketService.clearError()">×</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .hub-container {
      min-height: 100vh;
      padding-bottom: 2rem;
    }

    .hub-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 2rem;
      position: sticky;
      top: 0;
      z-index: 100;
      margin: 1rem;
      border-radius: 1rem;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .logo {
      font-size: 1.75rem;
    }

    .title {
      font-size: 1.25rem;
      background: var(--gradient-primary);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .player-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: var(--bg-tertiary);
      border-radius: 9999px;
      font-weight: 500;
    }

    .hub-main {
      padding-top: 1rem;
    }

    .section {
      margin-bottom: 2.5rem;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .section-header h2 {
      font-size: 1.25rem;
    }

    .games-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .game-card {
      cursor: pointer;
      text-align: center;
      padding: 2rem;
      transition: all 0.3s ease;
    }

    .game-card:hover {
      transform: translateY(-4px);
      border-color: var(--primary);
    }

    .game-card-coming {
      opacity: 0.5;
      cursor: default;
    }

    .game-card-coming:hover {
      transform: none;
      border-color: var(--border-color);
    }

    .game-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .game-title {
      margin-bottom: 0.5rem;
    }

    .game-description {
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .rooms-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .room-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      cursor: pointer;
    }

    .room-card:hover {
      border-color: var(--primary);
    }

    .room-info h4 {
      margin-bottom: 0.25rem;
    }

    .room-game {
      font-size: 0.875rem;
      color: var(--text-muted);
    }

    .room-meta {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .room-players {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-secondary);
    }

    .empty-state {
      text-align: center;
      padding: 3rem;
    }

    .empty-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .join-form {
      display: flex;
      gap: 1rem;
      padding: 1rem;
    }

    .join-form .input {
      flex: 1;
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }

    .modal {
      width: 100%;
      max-width: 480px;
      padding: 2rem;
    }

    .modal-title {
      margin-bottom: 1.5rem;
      text-align: center;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-label {
      display: block;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }

    .visibility-options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .visibility-option {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1.25rem 1rem;
      background: var(--bg-secondary);
      border: 2px solid var(--border-color);
      border-radius: 0.75rem;
      cursor: pointer;
      transition: all 0.2s ease;
      color: var(--text-primary);
    }

    .visibility-option svg {
      color: var(--text-secondary);
      transition: color 0.2s ease;
    }

    .visibility-option:hover {
      border-color: var(--primary);
      background: var(--bg-tertiary);
    }

    .visibility-option:hover svg {
      color: var(--primary);
    }

    .visibility-option.active {
      border-color: var(--primary);
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%);
    }

    .visibility-option.active svg {
      color: var(--primary);
    }

    .visibility-option span {
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--text-primary);
    }

    .visibility-option small {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-align: center;
    }

    .modal-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      margin-top: 2rem;
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 2rem;
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
      opacity: 0.8;
    }

    .toast-close:hover {
      opacity: 1;
    }
  `]
})
export class HubComponent implements OnInit, OnDestroy {
  socketService = inject(SocketService);
  themeService = inject(ThemeService);
  private router = inject(Router);

  showCreateModal = signal(false);
  selectedGame = signal<GameType | null>(null);
  roomName = signal('');
  isPrivate = signal(false);
  privateCode = signal('');

  private refreshInterval: any;

  ngOnInit(): void {
    // Vérifier que le joueur est connecté
    if (!this.socketService.currentPlayer()) {
      this.router.navigate(['/']);
      return;
    }

    // Rafraîchir la liste des rooms
    this.refreshRooms();
    this.refreshInterval = setInterval(() => this.refreshRooms(), 5000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  getGameName(type: GameType): string {
    const names: Record<GameType, string> = {
      skyjo: 'Skyjo'
    };
    return names[type] || type;
  }

  refreshRooms(): void {
    this.socketService.refreshRooms();
  }

  openCreateModal(game: GameType): void {
    this.selectedGame.set(game);
    this.showCreateModal.set(true);
    this.roomName.set('');
    this.isPrivate.set(false);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.selectedGame.set(null);
  }

  onRoomNameChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.roomName.set(input.value);
  }

  onCodeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.privateCode.set(input.value.toUpperCase());
  }

  createRoom(event: Event): void {
    event.preventDefault();

    if (!this.selectedGame()) return;

    this.socketService.createRoom(
      this.roomName() || `Partie de ${this.socketService.currentPlayer()?.username}`,
      this.selectedGame()!,
      this.isPrivate()
    );

    this.closeCreateModal();

    // Attendre que la room soit créée pour rediriger vers le lobby
    const checkRoom = setInterval(() => {
      if (this.socketService.currentRoom()) {
        clearInterval(checkRoom);
        this.router.navigate(['/lobby']);
      }
    }, 100);

    setTimeout(() => clearInterval(checkRoom), 3000);
  }

  joinRoom(roomId: string): void {
    this.socketService.joinRoom(roomId);

    const checkRoom = setInterval(() => {
      if (this.socketService.currentRoom()) {
        clearInterval(checkRoom);
        this.router.navigate(['/lobby']);
      }
    }, 100);

    setTimeout(() => clearInterval(checkRoom), 3000);
  }

  joinPrivateRoom(event: Event): void {
    event.preventDefault();

    if (!this.privateCode()) return;

    // Essayer de rejoindre avec le code comme ID de room
    this.socketService.joinRoom(this.privateCode(), this.privateCode());

    const checkRoom = setInterval(() => {
      if (this.socketService.currentRoom()) {
        clearInterval(checkRoom);
        this.router.navigate(['/lobby']);
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkRoom);
      this.privateCode.set('');
    }, 3000);
  }
}
