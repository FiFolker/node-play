/**
 * Hub principal - Liste des jeux et parties disponibles
 */

import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { SocketService } from '../../services/socket.service';
import { ThemeService } from '../../services/theme.service';
import type { GameType } from '../../types';

@Component({
  selector: 'app-hub',
  templateUrl: './hub.component.html',
  styleUrl: './hub.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
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

  // Mode solo
  showSoloModal = signal(false);
  numBots = signal(3);

  // Profile management
  isRenaming = signal(false);
  newName = signal('');

  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  startRenaming(): void {
    const current = this.socketService.currentPlayer();
    if (current) {
      this.newName.set(current.username);
      this.isRenaming.set(true);
    }
  }

  cancelRenaming(): void {
    this.isRenaming.set(false);
  }

  confirmRename(): void {
    const name = this.newName().trim();
    if (name.length >= 2) {
      this.socketService.rename(name);
      this.isRenaming.set(false);
    }
  }

  logout(): void {
    this.socketService.logout();
    this.router.navigate(['/']);
  }

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

  // ============================================
  // Mode Solo
  // ============================================

  openSoloModal(): void {
    this.showSoloModal.set(true);
    this.numBots.set(3); // Par défaut 3 bots
  }

  closeSoloModal(): void {
    this.showSoloModal.set(false);
  }

  onNumBotsChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.numBots.set(parseInt(input.value, 10));
  }

  startSoloGame(): void {
    this.socketService.createSoloRoom(this.numBots());
    this.closeSoloModal();

    // Attendre que le jeu démarre pour rediriger vers la partie
    const checkGame = setInterval(() => {
      if (this.socketService.gameState()) {
        clearInterval(checkGame);
        this.router.navigate(['/skyjo']);
      }
    }, 100);

    setTimeout(() => clearInterval(checkGame), 3000);
  }
}
