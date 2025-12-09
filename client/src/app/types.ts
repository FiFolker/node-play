/**
 * Types partagés entre le serveur et le client
 * Copie locale pour le client Angular
 */

// ============================================
// Types pour les joueurs
// ============================================

export interface Player {
    id: string;
    username: string;
    isHost: boolean;
    isReady: boolean;
}

// ============================================
// Types pour les lobbies/parties
// ============================================

export type GameType = 'skyjo';

export interface GameRoom {
    id: string;
    name: string;
    gameType: GameType;
    isPrivate: boolean;
    privateCode?: string;
    hostId: string;
    players: Player[];
    maxPlayers: number;
    minPlayers: number;
    status: 'waiting' | 'playing' | 'finished';
}

// ============================================
// Types pour Skyjo
// ============================================

export interface SkyjoCard {
    value: number;
    isRevealed: boolean;
    id: string;
}

export interface SkyjoPlayerState {
    oderId: string;       // Socket ID
    username: string;
    grid: SkyjoCard[][];  // Grille 4x3 (4 colonnes, 3 lignes)
    score: number;        // Score cumulé sur toutes les manches
    roundScore: number;   // Score de la manche en cours
    hasFinished: boolean; // A révélé toutes ses cartes ?
    disconnected?: boolean; // Joueur déconnecté ?
}

export interface SkyjoGameState {
    roomId: string;
    players: SkyjoPlayerState[];
    currentPlayerIndex: number;
    drawPile: SkyjoCard[];
    discardPile: SkyjoCard[];
    phase: 'setup' | 'playing' | 'lastTurn' | 'roundEnd' | 'gameEnd';
    setupPhase?: {
        playersReady: string[];
    };
    drawnCard?: SkyjoCard;
    roundNumber: number;
    finisherId?: string;
}

// ============================================
// Événements Socket.io
// ============================================

export interface ClientToServerEvents {
    'player:join': (username: string) => void;
    'room:create': (data: { name: string; gameType: GameType; isPrivate: boolean }) => void;
    'room:join': (data: { roomId: string; privateCode?: string }) => void;
    'room:leave': () => void;
    'room:ready': () => void;
    'room:start': () => void;
    'room:list': () => void;
    'skyjo:revealInitial': (cardIndices: [number, number]) => void;
    'skyjo:drawFromDeck': () => void;
    'skyjo:drawFromDiscard': () => void;
    'skyjo:swapCard': (position: { col: number; row: number }) => void;
    'skyjo:discardDrawn': () => void;
    'skyjo:revealCard': (position: { col: number; row: number }) => void;
}

export interface ServerToClientEvents {
    'player:connected': (player: Player) => void;
    'player:error': (message: string) => void;
    'room:created': (room: GameRoom) => void;
    'room:joined': (room: GameRoom) => void;
    'room:updated': (room: GameRoom) => void;
    'room:left': () => void;
    'room:list': (rooms: GameRoom[]) => void;
    'room:error': (message: string) => void;
    'skyjo:state': (state: SkyjoGameState) => void;
    'skyjo:yourTurn': () => void;
    'skyjo:cardDrawn': (card: SkyjoCard) => void;
    'skyjo:roundEnd': (scores: { playerId: string; roundScore: number; totalScore: number }[]) => void;
    'skyjo:gameEnd': (winner: { playerId: string; username: string; score: number }) => void;
    'skyjo:error': (message: string) => void;
}
