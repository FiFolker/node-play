/**
 * Lobby - Salle d'attente avant le début du jeu
 */

import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { SocketService } from '../../services/socket.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-lobby',
  templateUrl: './lobby.component.html',
  styleUrl: './lobby.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
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

  canAddBot(): boolean {
    const room = this.socketService.currentRoom();
    if (!room) return false;
    return room.players.length < room.maxPlayers;
  }

  addBot(): void {
    this.socketService.addBot();
  }

  removeBot(botId: string): void {
    this.socketService.removeBot(botId);
  }
}
