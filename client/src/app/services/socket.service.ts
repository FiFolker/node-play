/**
 * Service de connexion Socket.io
 * Gère la communication temps réel avec le serveur
 */

import { Injectable, signal, computed } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import type {
    ClientToServerEvents,
    ServerToClientEvents,
    Player,
    GameRoom,
    SkyjoGameState,
    SkyjoCard,
    GameType
} from '../types';

@Injectable({
    providedIn: 'root'
})
export class SocketService {
    private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

    // État réactif avec Signals (Angular 21)
    private _isConnected = signal(false);
    private _currentPlayer = signal<Player | null>(null);
    private _currentRoom = signal<GameRoom | null>(null);
    private _publicRooms = signal<GameRoom[]>([]);
    private _gameState = signal<SkyjoGameState | null>(null);
    private _drawnCard = signal<SkyjoCard | null>(null);
    private _error = signal<string | null>(null);
    private _roundEndScores = signal<{ playerId: string; roundScore: number; totalScore: number }[] | null>(null);
    private _gameEndWinner = signal<{ playerId: string; username: string; score: number } | null>(null);
    private _onlineCount = signal<number>(0);
    private _isDev = signal<boolean>(typeof window !== 'undefined' && window.location.port === '4200');

    // Signaux publics (lecture seule)
    readonly isConnected = this._isConnected.asReadonly();
    readonly currentPlayer = this._currentPlayer.asReadonly();
    readonly currentRoom = this._currentRoom.asReadonly();
    readonly publicRooms = this._publicRooms.asReadonly();
    readonly gameState = this._gameState.asReadonly();
    readonly drawnCard = this._drawnCard.asReadonly();
    readonly error = this._error.asReadonly();
    readonly roundEndScores = this._roundEndScores.asReadonly();
    readonly gameEndWinner = this._gameEndWinner.asReadonly();
    readonly onlineCount = this._onlineCount.asReadonly();
    readonly isDev = this._isDev.asReadonly();

    // Signaux dérivés
    readonly isInRoom = computed(() => this._currentRoom() !== null);
    readonly isHost = computed(() => {
        const room = this._currentRoom();
        const player = this._currentPlayer();
        return room && player ? room.hostId === player.id : false;
    });
    readonly isMyTurn = computed(() => {
        const state = this._gameState();
        const player = this._currentPlayer();
        if (!state || !player) return false;
        return state.players[state.currentPlayerIndex]?.oderId === player.id;
    });

    /**
     * Connecte au serveur Socket.io
     */
    connect(serverUrl: string = 'http://localhost:3000'): void {
        if (this.socket?.connected) return;

        this.socket = io(serverUrl, {
            transports: ['websocket', 'polling']
        });

        this.setupListeners();
    }

    /**
     * Rejoint le serveur avec un pseudo
     */
    join(username: string): void {
        if (!this.socket) return;
        this.socket.emit('player:join', username);
        this.saveSession(username);
    }

    /**
     * Change le pseudo du joueur
     */
    rename(username: string): void {
        if (!this.socket) return;
        this.socket.emit('player:rename', username);
    }

    /**
     * Déconnecte le joueur et efface la session
     */
    logout(): void {
        if (!this.socket) return;
        this.socket.disconnect();
        this.clearSession();
        this._isConnected.set(false);
        this._currentPlayer.set(null);
        this._currentRoom.set(null);
        this.connect();
    }

    // --- Gestion de Session ---

    private readonly SESSION_KEY = 'skyjo_session';

    private saveSession(username: string): void {
        try {
            localStorage.setItem(this.SESSION_KEY, JSON.stringify({ username }));
        } catch (e) {
            console.error('Erreur localStorage:', e);
        }
    }

    clearSession(): void {
        try {
            localStorage.removeItem(this.SESSION_KEY);
        } catch (e) {
            console.error('Erreur localStorage:', e);
        }
    }

    restoreSession(): { username: string } | null {
        try {
            const data = localStorage.getItem(this.SESSION_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Configure les écouteurs d'événements
     */
    private setupListeners(): void {
        if (!this.socket) return;

        // Connexion
        this.socket.on('connect', () => {
            this._isConnected.set(true);
            console.log('[Socket] Connecté au serveur');
        });

        this.socket.on('disconnect', () => {
            this._isConnected.set(false);
            this._currentPlayer.set(null);
            this._currentRoom.set(null);
            console.log('[Socket] Déconnecté');
        });

        // Joueur
        this.socket.on('player:connected', (player) => {
            this._currentPlayer.set(player);
            this._error.set(null);
            console.log('[Socket] Joueur connecté:', player.username);
        });

        this.socket.on('player:updated', (player) => {
            this._currentPlayer.set(player);
            this.saveSession(player.username);
            console.log('[Socket] Profil mis à jour:', player.username);
        });

        this.socket.on('players:online', (count) => {
            this._onlineCount.set(count);
        });

        this.socket.on('player:error', (message) => {
            this._error.set(message);
        });

        // Room
        this.socket.on('room:created', (room) => {
            this._currentRoom.set(room);
            this._error.set(null);
        });

        this.socket.on('room:joined', (room) => {
            this._currentRoom.set(room);
            this._error.set(null);
        });

        this.socket.on('room:updated', (room) => {
            this._currentRoom.set(room);
        });

        this.socket.on('room:left', () => {
            this._currentRoom.set(null);
            this._gameState.set(null);
            this._drawnCard.set(null);
        });

        this.socket.on('room:list', (rooms) => {
            this._publicRooms.set(rooms);
        });

        this.socket.on('room:error', (message) => {
            this._error.set(message);
        });

        // Skyjo
        this.socket.on('skyjo:state', (state) => {
            this._gameState.set(state);
            this._error.set(null);
        });

        this.socket.on('skyjo:cardDrawn', (card) => {
            this._drawnCard.set(card);
        });

        this.socket.on('skyjo:roundEnd', (scores) => {
            console.log('[Socket] roundEnd reçu:', scores);
            this._roundEndScores.set(scores);
        });

        this.socket.on('skyjo:gameEnd', (winner) => {
            console.log('[Socket] gameEnd reçu:', winner);
            // Effacer roundEndScores pour afficher le modal de fin de partie
            this._roundEndScores.set(null);
            this._gameEndWinner.set(winner);
        });

        this.socket.on('skyjo:error', (message) => {
            this._error.set(message);
        });
    }

    // ============================================
    // Actions joueur
    // ============================================



    // ============================================
    // Actions room
    // ============================================

    createRoom(name: string, gameType: GameType, isPrivate: boolean): void {
        this.socket?.emit('room:create', { name, gameType, isPrivate });
    }

    createSoloRoom(numBots: number): void {
        this.socket?.emit('room:createSolo', { numBots });
    }

    joinRoom(roomId: string, privateCode?: string): void {
        this.socket?.emit('room:join', { roomId, privateCode });
    }

    leaveRoom(): void {
        // Nettoyer l'état local AVANT d'émettre au serveur
        this._currentRoom.set(null);
        this._gameState.set(null);
        this._drawnCard.set(null);
        this._roundEndScores.set(null);
        this._gameEndWinner.set(null);
        this._error.set(null);

        // Informer le serveur
        this.socket?.emit('room:leave');
    }

    toggleReady(): void {
        this.socket?.emit('room:ready');
    }

    startGame(): void {
        this.socket?.emit('room:start');
    }

    refreshRooms(): void {
        this.socket?.emit('room:list');
    }

    addBot(): void {
        this.socket?.emit('room:addBot');
    }

    removeBot(botId: string): void {
        this.socket?.emit('room:removeBot', { botId });
    }

    // ============================================
    // Actions Skyjo
    // ============================================

    revealInitialCards(cardIndices: [number, number]): void {
        this.socket?.emit('skyjo:revealInitial', cardIndices);
    }

    drawFromDeck(): void {
        this._drawnCard.set(null);
        this.socket?.emit('skyjo:drawFromDeck');
    }

    drawFromDiscard(): void {
        this._drawnCard.set(null);
        this.socket?.emit('skyjo:drawFromDiscard');
    }

    swapCard(col: number, row: number): void {
        this.socket?.emit('skyjo:swapCard', { col, row });
        this._drawnCard.set(null);
    }

    discardDrawn(): void {
        this.socket?.emit('skyjo:discardDrawn');
        this._drawnCard.set(null);
    }

    revealCard(col: number, row: number): void {
        this.socket?.emit('skyjo:revealCard', { col, row });
    }

    // ============================================
    // Utilitaires
    // ============================================

    clearError(): void {
        this._error.set(null);
    }

    clearRoundEnd(): void {
        this._roundEndScores.set(null);
    }

    clearGameEnd(): void {
        this._gameEndWinner.set(null);
    }

    disconnect(): void {
        this.socket?.disconnect();
        this.socket = null;
    }
}
