/**
 * Interface de jeu Skyjo V4
 * Corrections: taille badge, icône pioche, bordure, joueurs déconnectés, phase setup
 */

import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { SocketService } from '../../services/socket.service';
import { ThemeService } from '../../services/theme.service';
import type { SkyjoCard, SkyjoPlayerState } from '../../types';

@Component({
  selector: 'app-skyjo',
  standalone: true,
  template: `
    <div class="game-wrapper">
      <!-- Header -->
      <header class="header">
        <button class="header-btn back" (click)="confirmQuit()" title="Quitter">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        
        <div class="header-center">
          <span class="manche"><span class="manche-full">Manche </span><span class="manche-abbr">M </span>{{ socketService.gameState()?.roundNumber }}</span>
          
          <!-- Phase setup: tout le monde révèle -->
          @if (phase() === 'setup') {
            <span class="status-badge setup">Révélez 2 cartes</span>
          } @else if (isMyTurn()) {
            <span class="status-badge myturn">Votre tour</span>
          } @else {
            <span class="status-badge waiting">{{ currentPlayerName() }}</span>
          }
        </div>

        <div class="header-actions">
          <button class="header-btn mobile-only" (click)="showLeaderboard.set(!showLeaderboard())" title="Classement">🏆</button>
          <button class="header-btn" (click)="themeService.toggle()" title="Thème">
            @if (themeService.theme() === 'dark') { ☀️ } @else { 🌙 }
          </button>
        </div>
      </header>

      <div class="game-layout">
        <!-- Zone de jeu -->
        <main class="game-area">
          <!-- Adversaires -->
          <section class="opponents">
            @for (player of allOpponents(); track player.oderId) {
              <div class="opponent" 
                   [class.playing]="isCurrentPlayer(player.oderId)"
                   [class.setup-active]="phase() === 'setup'"
                   [class.disconnected]="player.disconnected">
                <div class="opp-header">
                  <span class="opp-name">
                    @if (player.disconnected) { ❌ }
                    {{ player.username }}
                  </span>
                  <span class="opp-score">{{ calculatePlayerScore(player) }}</span>
                </div>
                <div class="mini-grid" [class.greyed]="player.disconnected">
                  @for (col of player.grid; track $index) {
                    <div class="mini-col">
                      @for (card of col; track card.id) {
                        <div class="mini-card" 
                             [class.revealed]="card.isRevealed" 
                             [class]="card.isRevealed ? getCardColorClass(card.value) : ''">
                          @if (card.isRevealed) { {{ card.value }} }
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </section>

          <!-- Piles centrales -->
          <section class="piles-area">
            <!-- Pioche -->
            <div class="pile-box">
              <div class="pile draw" [class.active]="canDrawFromDeck()" (click)="drawFromDeck()">
                <div class="card-stack">
                  <div class="stack-card"></div>
                  <div class="stack-card"></div>
                  <div class="stack-card"></div>
                </div>
                <span class="pile-nb">{{ socketService.gameState()?.drawPile?.length }}</span>
              </div>
              <span class="pile-txt">Pioche</span>
            </div>

            <!-- Carte en main -->
            @if (socketService.drawnCard(); as card) {
              <div class="hand-box">
                <div class="hand-card" [class]="getCardColorClass(card.value)">{{ card.value }}</div>
                <button class="hand-discard" (click)="discardDrawn()">Défausser</button>
              </div>
            }

            <!-- Défausse -->
            <div class="pile-box">
              <div class="pile discard" [class.active]="canDrawFromDiscard()" (click)="drawFromDiscard()">
                @if (topDiscard(); as card) {
                  <div class="discard-top" [class]="getCardColorClass(card.value)">{{ card.value }}</div>
                } @else {
                  <span class="empty-pile">Vide</span>
                }
              </div>
              <span class="pile-txt">Défausse</span>
            </div>
          </section>

          <!-- Mon plateau -->
          <section class="my-board" [class.my-turn]="isMyTurn()" [class.setup-active]="phase() === 'setup'">
            <div class="my-header">
              <span class="my-name">{{ socketService.currentPlayer()?.username }}</span>
              <span class="my-score">{{ myCurrentScore() }} pts</span>
            </div>
            <div class="my-grid">
              @for (col of myPlayerState()?.grid || []; track $index; let colIdx = $index) {
                <div class="my-col">
                  @for (card of col; track card.id; let rowIdx = $index) {
                    <button 
                      class="my-card"
                      [class.revealed]="card.isRevealed"
                      [class.clickable]="canClickCard(colIdx, rowIdx)"
                      [class.selecting]="isSelectingInitial() && !card.isRevealed"
                      [class.selected]="isCardSelected(colIdx, rowIdx)"
                      [class]="card.isRevealed ? getCardColorClass(card.value) : ''"
                      [disabled]="!canClickCard(colIdx, rowIdx)"
                      (click)="onCardClick(colIdx, rowIdx)"
                    >
                      @if (card.isRevealed) { {{ card.value }} } @else { ? }
                    </button>
                  }
                </div>
              }
            </div>
            <div class="hint">
              @if (phase() === 'setup') {
                @if (hasRevealedInitial()) { ⏳ En attente des autres... } @else { 👆 Sélectionnez {{ 2 - selectedInitialCards().length }} carte(s) }
              } @else if (isMyTurn()) {
                @if (socketService.drawnCard()) { 🔄 Échangez ou défaussez }
                @else if (mustRevealCard()) { 👁️ Révélez une carte }
                @else { 🃏 Piochez une carte }
              } @else {
                ⏳ Tour de {{ currentPlayerName() }}
              }
            </div>
          </section>
        </main>

        <!-- Leaderboard -->
        <aside class="leaderboard" [class.visible]="showLeaderboard()">
          <h4>🏆 Scores</h4>
          @for (p of sortedPlayers(); track p.oderId; let i = $index) {
            <div class="lb-row" [class.me]="p.oderId === socketService.currentPlayer()?.id" [class.dc]="p.disconnected">
              <span class="lb-rank">{{ i + 1 }}</span>
              <span class="lb-name">{{ p.username }}</span>
              <span class="lb-score">{{ p.score }}</span>
            </div>
          }
          <button class="lb-close mobile-only" (click)="showLeaderboard.set(false)">Fermer</button>
        </aside>
      </div>

      <!-- Modal quitter -->
      @if (showQuitConfirm()) {
        <div class="overlay" (click)="showQuitConfirm.set(false)">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>Quitter la partie ?</h3>
            <p>Vous serez retiré de la partie en cours.</p>
            <div class="modal-btns">
              <button class="btn-cancel" (click)="showQuitConfirm.set(false)">Annuler</button>
              <button class="btn-danger" (click)="quitGame()">Quitter</button>
            </div>
          </div>
        </div>
      }

      <!-- Modal fin de manche -->
      @if (socketService.roundEndScores()) {
        <div class="overlay">
          <div class="modal">
            <h3>📊 Fin de manche</h3>
            @for (s of sortedScores(); track s.playerId; let i = $index) {
              <div class="score-row" [class.me]="s.playerId === socketService.currentPlayer()?.id">
                <span class="sr-rank">{{ i + 1 }}</span>
                <span class="sr-name">{{ getPlayerName(s.playerId) }}</span>
                <span class="sr-delta">+{{ s.roundScore }}</span>
                <span class="sr-total">{{ s.totalScore }}</span>
              </div>
            }
            <button class="btn-primary" (click)="socketService.clearRoundEnd()">Continuer</button>
          </div>
        </div>
      }

      <!-- Modal victoire -->
      @if (socketService.gameEndWinner(); as w) {
        <div class="overlay">
          <div class="modal victory">
            <div class="trophy">🏆</div>
            <h3>@if (w.playerId === socketService.currentPlayer()?.id) { Victoire ! } @else { {{ w.username }} gagne ! }</h3>
            <p>Score final: {{ w.score }} pts</p>
            <button class="btn-light" (click)="returnToHub()">Retour au menu</button>
          </div>
        </div>
      }

      @if (socketService.error()) {
        <div class="toast">{{ socketService.error() }}<button (click)="socketService.clearError()">✕</button></div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .game-wrapper {
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--bg-primary);
      overflow: hidden;
    }

    /* === HEADER === */
    .header {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.75rem;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
    }

    .header-btn {
      width: 34px;
      height: 34px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-tertiary);
      color: var(--text-primary);
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .header-btn.back svg { stroke: var(--text-primary); }
    .header-btn:hover { background: var(--border-color); }
    .header-btn.back:hover { background: var(--danger); border-color: var(--danger); }
    .header-btn.back:hover svg { stroke: white; }

    .header-center {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .manche {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      background: var(--bg-tertiary);
      border-radius: 4px;
      color: var(--text-secondary);
    }

    .manche-full { display: inline; }
    .manche-abbr { display: none; }

    @media (max-width: 500px) {
      .manche-full { display: none; }
      .manche-abbr { display: inline; }
    }

    .status-badge {
      padding: 0.3rem 0.6rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .status-badge.setup { background: var(--warning); color: #000; }
    .status-badge.myturn { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; }
    .status-badge.waiting { background: var(--bg-tertiary); color: var(--text-secondary); }

    .header-actions { display: flex; gap: 0.4rem; }

    /* === LAYOUT === */
    .game-layout {
      flex: 1;
      display: flex;
      overflow: hidden;
    }

    .game-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 0.5rem 0.5rem 0;
      gap: 0.4rem;
      min-height: 0;
    }

    /* === ADVERSAIRES === */
    .opponents {
      flex: 1;
      display: flex;
      justify-content: center;
      align-content: flex-start;
      gap: 0.4rem;
      flex-wrap: wrap;
      overflow-y: auto;
      min-height: 0;
    }

    .opponent {
      background: var(--bg-secondary);
      border: 2px solid var(--border-color);
      border-radius: 8px;
      padding: 0.4rem;
      transition: all 0.2s;
    }

    .opponent.playing {
      border-color: var(--primary);
      box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
    }

    .opponent.setup-active {
      border-color: var(--warning);
      box-shadow: 0 0 8px rgba(250, 204, 21, 0.3);
    }

    .opponent.disconnected {
      opacity: 0.5;
      filter: grayscale(0.5);
    }

    .opp-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.4rem;
      margin-bottom: 0.25rem;
    }

    .opp-name {
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .opp-score {
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--primary);
      background: rgba(99, 102, 241, 0.2);
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
    }

    .mini-grid {
      display: flex;
      gap: 2px;
    }

    .mini-grid.greyed { filter: grayscale(1); }

    .mini-col {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .mini-card {
      width: 28px;
      height: 36px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
      font-weight: 700;
      background: linear-gradient(145deg, #6366f1, #4338ca);
      color: rgba(255,255,255,0.4);
    }

    .mini-card.revealed { color: white; }

    /* === PILES === */
    .piles-area {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1.5rem;
      flex-shrink: 0;
      padding: 0.5rem 0;
    }

    .pile-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
    }

    .pile-txt {
      font-size: 0.6rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .pile {
      width: 52px;
      height: 68px;
      border-radius: 6px;
      cursor: default;
      transition: all 0.2s;
    }

    .pile.active { cursor: pointer; }
    .pile.active:hover { transform: translateY(-3px); }

    .pile.draw {
      position: relative;
    }

    .card-stack {
      position: relative;
      width: 100%;
      height: 100%;
    }

    .stack-card {
      position: absolute;
      width: 100%;
      height: 100%;
      background: linear-gradient(145deg, #6366f1, #4338ca);
      border-radius: 6px;
      border: 1.5px solid rgba(255,255,255,0.2);
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }

    .stack-card:nth-child(1) { transform: translate(3px, 3px); }
    .stack-card:nth-child(2) { transform: translate(1.5px, 1.5px); }

    .pile-nb {
      position: absolute;
      bottom: 4px;
      right: 4px;
      font-size: 0.55rem;
      font-weight: 700;
      color: white;
      background: rgba(0,0,0,0.35);
      padding: 1px 4px;
      border-radius: 3px;
    }

    .pile.discard {
      border: 2px dashed var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .pile.discard.active:hover { border-color: var(--primary); }

    .discard-top {
      width: 100%;
      height: 100%;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.15rem;
      font-weight: 800;
    }

    .empty-pile { font-size: 0.65rem; color: var(--text-muted); }

    .hand-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
    }

    .hand-card {
      width: 52px;
      height: 68px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3rem;
      font-weight: 800;
      box-shadow: 0 4px 15px rgba(0,0,0,0.25);
      animation: float 1.5s ease-in-out infinite;
    }

    .hand-discard {
      padding: 0.3rem 0.6rem;
      background: var(--danger);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      cursor: pointer;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }

    /* === MON PLATEAU === */
    .my-board {
      flex-shrink: 0;
      margin-top: auto;
      display: flex;
      flex-direction: column;
      background: var(--bg-secondary);
      border: 2px solid var(--border-color);
      border-bottom: none;
      border-radius: 12px 12px 0 0;
      padding: 0.5rem 0.6rem;
    }

    .my-board.my-turn {
      border-color: var(--primary);
      box-shadow: 0 -4px 12px rgba(99, 102, 241, 0.2);
    }

    .my-board.setup-active {
      border-color: var(--warning);
      box-shadow: 0 -4px 12px rgba(250, 204, 21, 0.2);
    }

    .my-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.4rem;
    }

    .my-name { font-weight: 700; font-size: 0.9rem; }
    .my-score { font-weight: 800; color: var(--primary); font-size: 1rem; }

    .my-grid {
      display: flex;
      justify-content: center;
      gap: 0.35rem;
      flex: 1;
      align-items: center;
    }

    .my-col {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .my-card {
      width: 52px;
      height: 68px;
      border-radius: 6px;
      border: 2px solid var(--border-color);
      background: linear-gradient(145deg, #6366f1, #4338ca);
      color: rgba(255,255,255,0.5);
      font-size: 1.15rem;
      font-weight: 800;
      cursor: default;
      transition: all 0.15s;
    }

    .my-card.revealed {
      background: var(--bg-primary);
      color: var(--text-primary);
      border-color: var(--border-color);
    }

    .my-card.clickable { cursor: pointer; }
    .my-card.clickable:hover {
      transform: translateY(-3px);
      border-color: var(--primary);
      box-shadow: 0 4px 10px rgba(99, 102, 241, 0.25);
    }

    .my-card.selecting:not(.revealed) { animation: pulse-select 1.2s infinite; }
    .my-card.selected { border-color: var(--success) !important; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25) !important; }

    @keyframes pulse-select {
      0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.35); }
      50% { box-shadow: 0 0 0 5px rgba(99, 102, 241, 0); }
    }

    .hint {
      text-align: center;
      font-size: 0.75rem;
      color: var(--text-secondary);
      margin-top: 0.4rem;
    }

    /* === COULEURS CARTES SKYJO === */
    /* -2, -1: Bleu violet */
    .card-negative { background: linear-gradient(145deg, #8b5cf6, #7c3aed) !important; color: white !important; }
    /* 0: Bleu clair */
    .card-zero { background: linear-gradient(145deg, #38bdf8, #0ea5e9) !important; color: white !important; }
    /* 1-4: Vert */
    .card-green { background: linear-gradient(145deg, #22c55e, #16a34a) !important; color: white !important; }
    /* 5-8: Jaune/Orange */
    .card-yellow { background: linear-gradient(145deg, #facc15, #eab308) !important; color: #1f2937 !important; }
    /* 9-12: Rouge */
    .card-red { background: linear-gradient(145deg, #ef4444, #dc2626) !important; color: white !important; }

    /* === LEADERBOARD === */
    .leaderboard {
      width: 140px;
      background: var(--bg-secondary);
      border-left: 1px solid var(--border-color);
      padding: 0.5rem;
      display: none;
      flex-direction: column;
    }

    .leaderboard h4 { font-size: 0.75rem; margin-bottom: 0.4rem; font-weight: 600; }

    .lb-row {
      display: flex;
      align-items: center;
      padding: 0.25rem 0.15rem;
      border-radius: 4px;
      font-size: 0.75rem;
    }

    .lb-row.me { background: rgba(99, 102, 241, 0.15); }
    .lb-row.dc { opacity: 0.5; text-decoration: line-through; }
    .lb-rank { width: 16px; color: var(--text-muted); font-size: 0.7rem; }
    .lb-name { flex: 1; font-size: 0.72rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .lb-score { font-weight: 700; color: var(--primary); font-size: 0.75rem; }

    .lb-close {
      margin-top: auto;
      padding: 0.35rem;
      background: var(--bg-tertiary);
      border: none;
      border-radius: 5px;
      font-size: 0.7rem;
      cursor: pointer;
      color: var(--text-primary);
    }

    @media (min-width: 768px) {
      .leaderboard { display: flex; }
      .mobile-only { display: none !important; }
      .my-card { width: 58px; height: 76px; font-size: 1.3rem; }
      .pile { width: 58px; height: 76px; }
      .hand-card { width: 58px; height: 76px; font-size: 1.4rem; }
    }

    @media (max-width: 767px) {
      .leaderboard {
        position: fixed;
        top: 52px;
        right: 0;
        width: 180px;
        height: auto;
        max-height: 70vh;
        border-radius: 0 0 0 12px;
        box-shadow: -3px 3px 15px rgba(0,0,0,0.2);
        z-index: 100;
      }

      .leaderboard.visible { display: flex; }
    }

    /* === MODALS === */
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(2px);
    }

    .modal {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 1.25rem;
      min-width: 260px;
      max-width: 90%;
      text-align: center;
      color: var(--text-primary);
    }

    .modal h3 { margin-bottom: 0.5rem; font-size: 1.1rem; }
    .modal p { color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1rem; }

    .modal-btns { display: flex; gap: 0.6rem; justify-content: center; }

    .btn-cancel, .btn-danger, .btn-primary, .btn-light {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      color: var(--text-primary);
    }

    .btn-cancel { background: var(--bg-tertiary); }
    .btn-danger { background: var(--danger); color: white; }
    .btn-primary { background: var(--gradient-primary); color: white; }
    .btn-light { background: white; color: var(--primary); }

    .score-row {
      display: flex;
      align-items: center;
      padding: 0.4rem 0.5rem;
      background: var(--bg-tertiary);
      border-radius: 5px;
      margin-bottom: 0.35rem;
      font-size: 0.8rem;
    }

    .score-row.me { background: rgba(99, 102, 241, 0.15); }
    .sr-rank { width: 22px; color: var(--text-muted); }
    .sr-name { flex: 1; text-align: left; }
    .sr-delta { color: var(--warning); margin-right: 0.6rem; }
    .sr-total { font-weight: 700; color: var(--primary); }

    .victory { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; }
    .trophy { font-size: 2.5rem; margin-bottom: 0.5rem; }

    .toast {
      position: fixed;
      bottom: 1rem;
      left: 50%;
      transform: translateX(-50%);
      background: var(--danger);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.8rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      z-index: 1001;
    }

    .toast button { background: none; border: none; color: white; font-size: 1rem; cursor: pointer; }
  `]
})
export class SkyjoComponent implements OnInit, OnDestroy {
  socketService = inject(SocketService);
  themeService = inject(ThemeService);
  private router = inject(Router);

  selectedInitialCards = signal<number[]>([]);
  private waitingForReveal = signal(false);
  showLeaderboard = signal(false);
  showQuitConfirm = signal(false);

  ngOnInit(): void {
    if (!this.socketService.gameState()) {
      this.router.navigate(['/hub']);
    }
  }

  ngOnDestroy(): void {
    // Réinitialiser la sélection quand on quitte
    this.selectedInitialCards.set([]);
  }

  phase = computed(() => this.socketService.gameState()?.phase || 'setup');
  isMyTurn = computed(() => this.socketService.isMyTurn());

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

  getCardColorClass(value: number): string {
    if (value < 0) return 'card-negative';  // -2, -1: bleu-violet
    if (value === 0) return 'card-zero';    // 0: bleu clair
    if (value <= 4) return 'card-green';    // 1-4: vert
    if (value <= 8) return 'card-yellow';   // 5-8: jaune
    return 'card-red';                      // 9-12: rouge
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
  confirmQuit(): void { this.showQuitConfirm.set(true); }
  quitGame(): void { this.showQuitConfirm.set(false); this.socketService.leaveRoom(); this.router.navigate(['/hub']); }
  returnToHub(): void { this.socketService.clearGameEnd(); this.socketService.leaveRoom(); this.router.navigate(['/hub']); }
}
