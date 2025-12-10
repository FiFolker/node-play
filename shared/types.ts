/**
 * Types partagés entre le serveur et le client
 * Définit les interfaces pour les événements Socket.io et les modèles de données
 */

// ============================================
// Types pour les joueurs
// ============================================

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface Player {
    id: string;           // Socket ID
    username: string;     // Pseudo du joueur
    isHost: boolean;      // Est-ce l'hôte de la partie ?
    isReady: boolean;     // Prêt à jouer ?
    isBot?: boolean;      // Est-ce un bot IA ?
    botDifficulty?: BotDifficulty; // Niveau de difficulté du bot
}

// ============================================
// Types pour les lobbies/parties
// ============================================

export type GameType = 'skyjo';

export interface GameRoom {
    id: string;           // ID unique de la room
    name: string;         // Nom de la partie
    gameType: GameType;   // Type de jeu
    isPrivate: boolean;   // Partie privée ?
    privateCode?: string; // Code si privée (4 caractères)
    hostId: string;       // Socket ID de l'hôte
    players: Player[];    // Liste des joueurs
    maxPlayers: number;   // Maximum 8 joueurs
    minPlayers: number;   // Minimum 2 joueurs
    status: 'waiting' | 'playing' | 'finished';
    isSolo?: boolean;     // Partie solo contre IA ?
}

// ============================================
// Types pour Skyjo
// ============================================

export interface SkyjoCard {
    value: number;        // Valeur de -2 à 12
    isRevealed: boolean;  // Carte visible ?
    id: string;           // ID unique pour les animations
}

export interface SkyjoPlayerState {
    oderId: string;       // Socket ID
    username: string;
    grid: SkyjoCard[][];  // Grille 4x3 (4 colonnes, 3 lignes)
    score: number;        // Score cumulé sur toutes les manches
    roundScore: number;   // Score de la manche en cours
    hasFinished: boolean; // A révélé toutes ses cartes ?
    disconnected?: boolean; // Joueur déconnecté ?
    isBot?: boolean;      // Est-ce un bot IA ?
    botDifficulty?: BotDifficulty; // Niveau de difficulté du bot
}

export interface SkyjoGameState {
    roomId: string;
    players: SkyjoPlayerState[];
    currentPlayerIndex: number;
    drawPile: SkyjoCard[];
    discardPile: SkyjoCard[];
    phase: 'setup' | 'playing' | 'lastTurn' | 'roundEnd' | 'gameEnd';
    setupPhase?: {
        playersReady: string[]; // Joueurs ayant révélé leurs 2 cartes
    };
    drawnCard?: SkyjoCard;  // Carte piochée en attente
    roundNumber: number;
    finisherId?: string;    // Joueur qui a terminé la manche
    readyForNextRound?: string[]; // Joueurs prêts pour la manche suivante (en phase roundEnd)
}

// ============================================
// Événements Socket.io - Client vers Serveur
// ============================================

export interface ClientToServerEvents {
    // Connexion
    'player:join': (username: string) => void;
    'player:rename': (username: string) => void;

    // Lobby
    'room:create': (data: { name: string; gameType: GameType; isPrivate: boolean }) => void;
    'room:join': (data: { roomId: string; privateCode?: string }) => void;
    'room:leave': () => void;
    'room:ready': () => void;
    'room:start': () => void;
    'room:list': () => void;
    'room:createSolo': (data: { numBots: number; difficulty?: BotDifficulty }) => void;
    'room:addBot': (data?: { difficulty?: BotDifficulty }) => void;
    'room:removeBot': (data: { botId: string }) => void;

    // Skyjo
    'skyjo:revealInitial': (cardIndices: [number, number]) => void;
    'skyjo:drawFromDeck': () => void;
    'skyjo:drawFromDiscard': () => void;
    'skyjo:swapCard': (position: { col: number; row: number }) => void;
    'skyjo:discardDrawn': () => void;
    'skyjo:revealCard': (position: { col: number; row: number }) => void;
    'skyjo:nextRound': () => void;
    'skyjo:readyForNextRound': () => void;  // Signaler qu'on est prêt pour la manche suivante
}

// ============================================
// Événements Socket.io - Serveur vers Client
// ============================================

export interface ServerToClientEvents {
    // Connexion
    'player:connected': (player: Player) => void;
    'player:error': (message: string) => void;
    'players:online': (count: number) => void;
    'player:updated': (player: Player) => void;

    // Lobby
    'room:created': (room: GameRoom) => void;
    'room:joined': (room: GameRoom) => void;
    'room:updated': (room: GameRoom) => void;
    'room:left': () => void;
    'room:list': (rooms: GameRoom[]) => void;
    'room:error': (message: string) => void;

    // Skyjo
    'skyjo:state': (state: SkyjoGameState) => void;
    'skyjo:yourTurn': () => void;
    'skyjo:cardDrawn': (card: SkyjoCard) => void;
    'skyjo:roundEnd': (data: { finishedRoundNumber: number; scores: { playerId: string; roundScore: number; totalScore: number }[] }) => void;
    'skyjo:gameEnd': (winner: { playerId: string; username: string; score: number }) => void;
    'skyjo:error': (message: string) => void;
}
