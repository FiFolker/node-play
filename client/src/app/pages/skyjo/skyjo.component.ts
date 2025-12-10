/**
 * Interface de jeu Skyjo V5
 * Refonte UI: composants partagés, thème dynamique, meilleure lisibilité
 */

import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy, effect } from '@angular/core';
import { Router } from '@angular/router';
import { SocketService } from '../../services/socket.service';
import { ThemeToggleComponent, QuitButtonComponent } from '../../shared';
import type { SkyjoCard, SkyjoPlayerState } from '../../types';

@Component({
  selector: 'app-skyjo',
  templateUrl: './skyjo.component.html',
  styleUrl: './skyjo.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ThemeToggleComponent, QuitButtonComponent]
})
export class SkyjoComponent implements OnInit, OnDestroy {
  socketService = inject(SocketService);
  private router = inject(Router);

  selectedInitialCards = signal<number[]>([]);
  private waitingForReveal = signal(false);
  showLeaderboard = signal(false);

  ngOnInit(): void {
    if (!this.socketService.gameState()) {
      this.router.navigate(['/hub']);
    }
    // Demander la permission pour les notifications au démarrage
    this.requestNotificationPermission();
  }

  ngOnDestroy(): void {
    // Réinitialiser la sélection quand on quitte
    this.selectedInitialCards.set([]);
  }

  // Computed signals doivent être définis AVANT l'effect
  phase = computed(() => this.socketService.gameState()?.phase || 'setup');
  isMyTurn = computed(() => this.socketService.isMyTurn());

  // State pour éviter les notifications dupliquées
  private lastNotifiedTurn = signal(false);

  // Effect pour envoyer une notification quand c'est notre tour
  private turnNotificationEffect = effect(() => {
    const isMyTurn = this.isMyTurn();
    const phase = this.phase();
    const wasNotified = this.lastNotifiedTurn();

    // Notifier seulement pendant la phase de jeu (pas pendant setup)
    // et seulement si ce n'est pas déjà notifié pour ce tour
    if (isMyTurn && (phase === 'playing' || phase === 'lastTurn') && !wasNotified) {
      this.sendTurnNotification();
      this.lastNotifiedTurn.set(true);
    } else if (!isMyTurn) {
      // Reset pour le prochain tour
      this.lastNotifiedTurn.set(false);
    }
  });

  private async requestNotificationPermission(): Promise<void> {
    if ('Notification' in window) {
      console.log('[Notifications] Permission actuelle:', Notification.permission);
      if (Notification.permission === 'default') {
        const result = await Notification.requestPermission();
        console.log('[Notifications] Permission demandée, résultat:', result);
      }
    } else {
      console.log('[Notifications] Non supportées par ce navigateur');
    }
  }

  private sendTurnNotification(): void {
    console.log('[Notifications] Tentative d\'envoi...');
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🎮 C\'est ton tour !', {
        body: 'Reviens jouer ta carte dans Skyjo',
        icon: '/favicon.ico',
        tag: 'skyjo-turn'
      });
      console.log('[Notifications] Notification envoyée!');
    } else {
      console.log('[Notifications] Permission non accordée:', Notification.permission);
    }
  }

  myPlayerState = computed(() => {
    const state = this.socketService.gameState();
    const player = this.socketService.currentPlayer();
    if (!state || !player) return null;
    return state.players.find((p: SkyjoPlayerState) => p.oderId === player.id);
  });

  opponents = computed(() => {
    const state = this.socketService.gameState();
    const player = this.socketService.currentPlayer();
    if (!state || !player) return [];
    return state.players.filter((p: SkyjoPlayerState) => p.oderId !== player.id);
  });

  // Adversaires (utilise directement la propriété disconnected du state)
  allOpponents = computed(() => this.opponents());

  sortedPlayers = computed(() => {
    const state = this.socketService.gameState();
    if (!state) return [];
    return [...state.players].sort((a, b) => a.score - b.score);
  });

  topDiscard = computed(() => {
    const pile = this.socketService.gameState()?.discardPile;
    if (!pile || pile.length === 0) return null;
    return pile[pile.length - 1];
  });

  currentPlayerName = computed(() => {
    const state = this.socketService.gameState();
    if (!state) return '';
    return state.players[state.currentPlayerIndex]?.username || '';
  });

  sortedScores = computed(() => {
    const scores = this.socketService.roundEndScores();
    if (!scores) return [];
    return [...scores].sort((a, b) => a.totalScore - b.totalScore);
  });

  mustRevealCard = computed(() => this.waitingForReveal());

  hasRevealedInitial = computed(() => {
    const player = this.socketService.currentPlayer();
    const state = this.socketService.gameState();
    if (!player || !state?.setupPhase) return false;
    return state.setupPhase.playersReady.includes(player.id);
  });

  isSelectingInitial = computed(() => this.phase() === 'setup' && !this.hasRevealedInitial());

  isCurrentPlayer(playerId: string): boolean {
    const state = this.socketService.gameState();
    if (!state) return false;
    return state.players[state.currentPlayerIndex]?.oderId === playerId;
  }

  getPlayerName(playerId: string): string {
    const state = this.socketService.gameState();
    if (!state) return '';
    return state.players.find((p: SkyjoPlayerState) => p.oderId === playerId)?.username || '';
  }

  // Determine CSS class based on card value
  getCardColorClass(value: number): string {
    if (value <= -1) return 'getCardColorClass-negative-dark'; // -2, -1: Bleu nuit violet
    if (value === 0) return 'getCardColorClass-zero-light';     // 0: Bleu clair
    if (value <= 4) return 'getCardColorClass-positive-green';  // 1-4: Vert
    if (value <= 8) return 'getCardColorClass-positive-yellow'; // 5-8: Jaune
    return 'getCardColorClass-positive-red';                    // 9-12: Rouge
  }

  // Calcule le score temps réel d'un joueur basé sur ses cartes révélées
  calculatePlayerScore(player: SkyjoPlayerState): number {
    let score = player.score; // Score accumulé des manches précédentes
    // Ajouter les cartes révélées de la manche en cours
    for (const col of player.grid) {
      for (const card of col) {
        if (card.isRevealed) {
          score += card.value;
        }
      }
    }
    return score;
  }

  // Calcule le score temps réel du joueur courant
  myCurrentScore(): number {
    const player = this.myPlayerState();
    if (!player) return 0;
    return this.calculatePlayerScore(player);
  }

  canDrawFromDeck = () => this.isMyTurn() && !this.socketService.drawnCard() && !this.waitingForReveal() && this.phase() !== 'setup';
  canDrawFromDiscard = () => this.isMyTurn() && !this.socketService.drawnCard() && !this.waitingForReveal() && this.phase() !== 'setup';

  canClickCard(col: number, row: number): boolean {
    if (this.isSelectingInitial()) return true;
    if (!this.isMyTurn()) return false;
    if (this.socketService.drawnCard()) return true;
    if (this.waitingForReveal()) {
      const card = this.myPlayerState()?.grid[col]?.[row];
      return card ? !card.isRevealed : false;
    }
    return false;
  }

  isCardSelected(col: number, row: number): boolean {
    const index = col * 3 + row;
    return this.selectedInitialCards().includes(index);
  }

  onCardClick(col: number, row: number): void {
    if (!this.canClickCard(col, row)) return;

    if (this.isSelectingInitial()) {
      const index = col * 3 + row;
      const selected = this.selectedInitialCards();

      if (selected.includes(index)) {
        this.selectedInitialCards.set(selected.filter(i => i !== index));
      } else if (selected.length < 2) {
        const newSelected = [...selected, index];
        this.selectedInitialCards.set(newSelected);

        if (newSelected.length === 2) {
          this.socketService.revealInitialCards(newSelected as [number, number]);
          // Réinitialiser après envoi
          setTimeout(() => this.selectedInitialCards.set([]), 500);
        }
      }
      return;
    }

    if (this.socketService.drawnCard()) {
      this.socketService.swapCard(col, row);
      return;
    }

    if (this.waitingForReveal()) {
      this.socketService.revealCard(col, row);
      this.waitingForReveal.set(false);
    }
  }

  drawFromDeck(): void { if (this.canDrawFromDeck()) this.socketService.drawFromDeck(); }
  drawFromDiscard(): void { if (this.canDrawFromDiscard()) this.socketService.drawFromDiscard(); }
  discardDrawn(): void { this.socketService.discardDrawn(); this.waitingForReveal.set(true); }

  quitGame(): void {
    this.socketService.leaveRoom();
    this.router.navigate(['/hub']);
  }

  returnToHub(): void {
    this.socketService.clearGameEnd();
    this.socketService.leaveRoom();
    this.router.navigate(['/hub']);
  }
}
