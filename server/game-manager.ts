/**
 * Gestionnaire de parties et de jeux
 * Gère les rooms, lobbies et coordonne les différents jeux
 */

import { Server } from 'socket.io';
import { SkyjoGame } from './games/skyjo.js';
import { SkyjoAI } from './games/skyjo-ai.js';
import type {
    GameRoom,
    GameType,
    Player,
    SkyjoGameState,
    ClientToServerEvents,
    ServerToClientEvents,
    SkyjoCard
} from '../shared/types.js';

// Génère un ID unique court
function generateId(length = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Génère un code privé de 4 chiffres
function generatePrivateCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

export class GameManager {
    private io: Server<ClientToServerEvents, ServerToClientEvents>;
    private rooms: Map<string, GameRoom> = new Map();
    private playerRooms: Map<string, string> = new Map(); // playerId -> roomId
    private skyjoGames: Map<string, SkyjoGame> = new Map(); // roomId -> SkyjoGame

    constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
        this.io = io;
    }

    /**
     * Récupère l'état actuel d'un jeu Skyjo
     */
    getGameState(roomId: string): SkyjoGameState | null {
        const game = this.skyjoGames.get(roomId);
        if (!game) return null;
        return game.getState(roomId);
    }

    // ============================================
    // Gestion des Rooms
    // ============================================

    /**
     * Crée une nouvelle room de jeu
     */
    createRoom(player: Player, name: string, gameType: GameType, isPrivate: boolean): GameRoom {
        // Si le joueur est déjà dans une room, le retirer
        this.leaveRoom(player);

        const roomId = generateId();
        const room: GameRoom = {
            id: roomId,
            name: name.trim() || `Partie de ${player.username}`,
            gameType,
            isPrivate,
            privateCode: isPrivate ? generatePrivateCode() : undefined,
            hostId: player.id,
            players: [{ ...player, isHost: true, isReady: false }],
            maxPlayers: 8,
            minPlayers: 2,
            status: 'waiting'
        };

        this.rooms.set(roomId, room);
        this.playerRooms.set(player.id, roomId);

        return room;
    }

    /**
     * Crée une room solo avec des bots IA
     */
    createSoloRoom(player: Player, numBots: number): { room: GameRoom; gameState: SkyjoGameState } {
        // Si le joueur est déjà dans une room, le retirer
        this.leaveRoom(player);

        // Limiter le nombre de bots entre 1 et 7
        const clampedBots = Math.max(1, Math.min(7, numBots));

        const roomId = generateId();

        // Créer les bots
        const bots: Player[] = [];
        for (let i = 0; i < clampedBots; i++) {
            bots.push({
                id: SkyjoAI.generateBotId(),
                username: SkyjoAI.generateBotName(i),
                isHost: false,
                isReady: true,
                isBot: true
            });
        }

        const room: GameRoom = {
            id: roomId,
            name: `Solo vs ${clampedBots} Bot${clampedBots > 1 ? 's' : ''}`,
            gameType: 'skyjo',
            isPrivate: true,
            hostId: player.id,
            players: [{ ...player, isHost: true, isReady: false }, ...bots],
            maxPlayers: 8,
            minPlayers: 1, // Solo: 1 joueur minimum
            status: 'playing', // Démarrer immédiatement
            isSolo: true
        };

        this.rooms.set(roomId, room);
        this.playerRooms.set(player.id, roomId);

        // Créer le jeu Skyjo et démarrer
        const skyjoGame = new SkyjoGame(room.players);
        this.skyjoGames.set(roomId, skyjoGame);

        // Faire révéler les cartes initiales des bots
        this.processBotInitialReveal(roomId);

        return { room, gameState: skyjoGame.getState(roomId) };
    }

    /**
     * Fait révéler les 2 cartes initiales par tous les bots
     * Public pour pouvoir être appelé après un roundEnd
     */
    processBotInitialReveal(roomId: string): void {
        const game = this.skyjoGames.get(roomId);
        const room = this.rooms.get(roomId);
        if (!game || !room) return;

        for (const player of room.players) {
            if (player.isBot) {
                const indices = SkyjoAI.chooseInitialCards();
                game.revealInitialCards(player.id, indices);
            }
        }
    }

    /**
     * Exécute les tours des bots automatiquement
     * Appelé après chaque action du joueur humain
     */
    processBotTurns(roomId: string): { gameState: SkyjoGameState; roundEnd?: any; gameEnd?: any } | null {
        const game = this.skyjoGames.get(roomId);
        const room = this.rooms.get(roomId);
        if (!game || !room) return null;

        // Vérifier s'il y a des bots dans la room
        const hasBots = room.players.some(p => p.isBot);
        if (!hasBots) return null;

        const state = game.getState(roomId);
        let currentState = state;
        let roundEnd = undefined;
        let gameEnd = undefined;

        // Si c'est le tour d'un bot, exécuter UN SEUL tour
        if (this.isCurrentPlayerBot(roomId)) {
            const botResult = this.executeSingleBotTurn(roomId);
            if (botResult) {
                currentState = botResult.gameState;
                if (botResult.roundEnd) roundEnd = botResult.roundEnd;
                if (botResult.gameEnd) gameEnd = botResult.gameEnd;
            }
        }

        return { gameState: currentState, roundEnd, gameEnd };
    }

    /**
     * Vérifie si le joueur actuel est un bot
     */
    private isCurrentPlayerBot(roomId: string): boolean {
        const game = this.skyjoGames.get(roomId);
        const room = this.rooms.get(roomId);
        if (!game || !room) return false;

        const state = game.getState(roomId);
        const currentPlayer = state.players[state.currentPlayerIndex];

        // Vérifier dans la room si ce joueur est un bot
        const roomPlayer = room.players.find(p => p.id === currentPlayer?.oderId);
        return roomPlayer?.isBot === true;
    }

    /**
     * Exécute un seul tour de bot
     */
    private executeSingleBotTurn(roomId: string): { gameState: SkyjoGameState; roundEnd?: any; gameEnd?: any } | null {
        const game = this.skyjoGames.get(roomId);
        if (!game) return null;

        const state = game.getState(roomId);
        const currentPlayer = state.players[state.currentPlayerIndex];
        if (!currentPlayer) return null;

        const playerId = currentPlayer.oderId;
        const topDiscard = state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1] : null;

        // Phase 1: Décider quoi faire
        let decision = SkyjoAI.decideTurn(currentPlayer, topDiscard, state.drawnCard || null);

        // Exécuter l'action
        if (decision.action === 'drawDeck') {
            game.drawFromDeck(playerId);
            // Redemander après avoir pioché
            const newState = game.getState(roomId);
            const updatedPlayer = newState.players.find(p => p.oderId === playerId);
            decision = SkyjoAI.decideTurn(updatedPlayer!, topDiscard, newState.drawnCard || null);
        } else if (decision.action === 'drawDiscard') {
            game.drawFromDiscard(playerId);
            // Redemander après avoir pioché
            const newState = game.getState(roomId);
            const updatedPlayer = newState.players.find(p => p.oderId === playerId);
            decision = SkyjoAI.decideTurn(updatedPlayer!, topDiscard, newState.drawnCard || null);
        }

        // Phase 2: Échanger ou défausser
        if (decision.action === 'swap') {
            const result = game.swapCard(playerId, { col: decision.col, row: decision.row });
            return {
                gameState: game.getState(roomId),
                roundEnd: result.roundEnd,
                gameEnd: result.gameEnd
            };
        } else if (decision.action === 'discard') {
            game.discardDrawnCard(playerId);
            // Révéler une carte
            const revealPos = SkyjoAI.chooseCardToReveal(currentPlayer);
            const result = game.revealCard(playerId, revealPos);
            return {
                gameState: game.getState(roomId),
                roundEnd: result.roundEnd,
                gameEnd: result.gameEnd
            };
        }

        return { gameState: game.getState(roomId) };
    }

    /**
     * Ajoute un bot à une room existante
     */
    addBot(player: Player): { room?: GameRoom; error?: string } {
        const roomId = this.playerRooms.get(player.id);
        if (!roomId) return { error: 'Vous n\'êtes dans aucune partie' };

        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Partie introuvable' };

        // Vérifier que le joueur est l'hôte
        if (room.hostId !== player.id) {
            return { error: 'Seul l\'hôte peut ajouter des bots' };
        }

        // Vérifier qu'il reste de la place
        if (room.players.length >= room.maxPlayers) {
            return { error: 'La partie est complète' };
        }

        // Vérifier que la partie n'a pas encore commencé
        if (room.status !== 'waiting') {
            return { error: 'La partie a déjà commencé' };
        }

        // Créer le bot
        const botIndex = room.players.filter(p => p.isBot).length;
        const bot: Player = {
            id: SkyjoAI.generateBotId(),
            username: SkyjoAI.generateBotName(botIndex),
            isHost: false,
            isReady: true,
            isBot: true
        };

        room.players.push(bot);
        return { room };
    }

    /**
     * Retire un bot d'une room existante
     */
    removeBot(player: Player, botId: string): { room?: GameRoom; error?: string } {
        const roomId = this.playerRooms.get(player.id);
        if (!roomId) return { error: 'Vous n\'êtes dans aucune partie' };

        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Partie introuvable' };

        // Vérifier que le joueur est l'hôte
        if (room.hostId !== player.id) {
            return { error: 'Seul l\'hôte peut retirer des bots' };
        }

        // Vérifier que la partie n'a pas encore commencé
        if (room.status !== 'waiting') {
            return { error: 'La partie a déjà commencé' };
        }

        // Trouver et retirer le bot
        const botIndex = room.players.findIndex(p => p.id === botId && p.isBot);
        if (botIndex === -1) {
            return { error: 'Bot non trouvé' };
        }

        room.players.splice(botIndex, 1);
        return { room };
    }

    /**
     * Rejoint une room existante
     */
    joinRoom(player: Player, roomId: string, privateCode?: string): { room?: GameRoom; error?: string } {
        let room = this.rooms.get(roomId);

        // Si la room n'existe pas par ID, chercher par code privé
        if (!room && privateCode) {
            room = Array.from(this.rooms.values()).find(r => r.privateCode === privateCode);
        }

        // Aussi essayer de chercher par le roomId comme code privé
        if (!room) {
            room = Array.from(this.rooms.values()).find(r => r.privateCode === roomId);
        }

        if (!room) {
            return { error: 'Cette partie n\'existe pas ou le code est incorrect' };
        }

        if (room.status !== 'waiting') {
            return { error: 'Cette partie a déjà commencé' };
        }

        if (room.players.length >= room.maxPlayers) {
            return { error: 'Cette partie est pleine' };
        }

        // Vérification du code pour les parties privées
        if (room.isPrivate && privateCode && room.privateCode !== privateCode && room.privateCode !== roomId) {
            return { error: 'Code incorrect' };
        }

        // Vérifier si le joueur est déjà dans cette room
        if (room.players.some(p => p.id === player.id)) {
            return { room };
        }

        // Si le joueur est dans une autre room, le retirer
        this.leaveRoom(player);

        // Ajouter le joueur à la room
        room.players.push({ ...player, isHost: false, isReady: false });
        this.playerRooms.set(player.id, room.id);

        return { room };
    }

    /**
     * Quitte la room actuelle
     */
    leaveRoom(player: Player): { room?: GameRoom } {
        const roomId = this.playerRooms.get(player.id);
        if (!roomId) return {};

        const room = this.rooms.get(roomId);
        if (!room) {
            this.playerRooms.delete(player.id);
            return {};
        }

        // Retirer le joueur de la room
        room.players = room.players.filter(p => p.id !== player.id);
        this.playerRooms.delete(player.id);

        // Si la room est vide, la supprimer
        if (room.players.length === 0) {
            this.rooms.delete(roomId);
            this.skyjoGames.delete(roomId);
            return {};
        }

        // Si l'hôte quitte, transférer le rôle
        if (room.hostId === player.id && room.players.length > 0) {
            room.hostId = room.players[0].id;
            room.players[0].isHost = true;
        }

        return { room };
    }

    /**
     * Toggle l'état "prêt" d'un joueur
     */
    toggleReady(player: Player): { room?: GameRoom } {
        const roomId = this.playerRooms.get(player.id);
        if (!roomId) return {};

        const room = this.rooms.get(roomId);
        if (!room) return {};

        const roomPlayer = room.players.find(p => p.id === player.id);
        if (roomPlayer) {
            roomPlayer.isReady = !roomPlayer.isReady;
        }

        return { room };
    }

    /**
     * Retourne la liste des rooms publiques en attente
     */
    getPublicRooms(): GameRoom[] {
        return Array.from(this.rooms.values())
            .filter(room => !room.isPrivate && room.status === 'waiting');
    }

    /**
     * Lance le jeu dans une room
     */
    startGame(player: Player): { room?: GameRoom; gameState?: SkyjoGameState; error?: string } {
        const roomId = this.playerRooms.get(player.id);
        if (!roomId) return { error: 'Vous n\'êtes dans aucune partie' };

        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Partie introuvable' };

        if (room.hostId !== player.id) {
            return { error: 'Seul l\'hôte peut lancer la partie' };
        }

        if (room.players.length < room.minPlayers) {
            return { error: `Il faut au moins ${room.minPlayers} joueurs` };
        }

        // Vérifier que tous les joueurs (sauf l'hôte) sont prêts
        const notReady = room.players.filter(p => !p.isHost && !p.isReady);
        if (notReady.length > 0) {
            return { error: 'Tous les joueurs doivent être prêts' };
        }

        // Démarrer le jeu selon son type
        room.status = 'playing';

        if (room.gameType === 'skyjo') {
            const skyjoGame = new SkyjoGame(room.players);
            this.skyjoGames.set(roomId, skyjoGame);
            return { room, gameState: skyjoGame.getState(roomId) };
        }

        return { error: 'Type de jeu non supporté' };
    }

    // ============================================
    // Gestion Skyjo
    // ============================================

    /**
     * Révèle les 2 cartes initiales d'un joueur
     */
    skyjoRevealInitial(player: Player, cardIndices: [number, number]): { gameState?: SkyjoGameState; roomId?: string; error?: string } {
        const roomId = this.playerRooms.get(player.id);
        if (!roomId) return { error: 'Partie introuvable' };

        const game = this.skyjoGames.get(roomId);
        if (!game) return { error: 'Jeu non trouvé' };

        const result = game.revealInitialCards(player.id, cardIndices);
        if (result.error) return { error: result.error };

        return { gameState: game.getState(roomId), roomId };
    }

    /**
     * Pioche une carte du deck
     */
    skyjoDrawFromDeck(player: Player): { gameState?: SkyjoGameState; drawnCard?: SkyjoCard; roomId?: string; error?: string } {
        const roomId = this.playerRooms.get(player.id);
        if (!roomId) return { error: 'Partie introuvable' };

        const game = this.skyjoGames.get(roomId);
        if (!game) return { error: 'Jeu non trouvé' };

        const result = game.drawFromDeck(player.id);
        if (result.error) return { error: result.error };

        return { gameState: game.getState(roomId), drawnCard: result.card, roomId };
    }

    /**
     * Pioche une carte de la défausse
     */
    skyjoDrawFromDiscard(player: Player): { gameState?: SkyjoGameState; drawnCard?: SkyjoCard; roomId?: string; error?: string } {
        const roomId = this.playerRooms.get(player.id);
        if (!roomId) return { error: 'Partie introuvable' };

        const game = this.skyjoGames.get(roomId);
        if (!game) return { error: 'Jeu non trouvé' };

        const result = game.drawFromDiscard(player.id);
        if (result.error) return { error: result.error };

        return { gameState: game.getState(roomId), drawnCard: result.card, roomId };
    }

    /**
     * Échange la carte piochée avec une carte de la grille
     */
    skyjoSwapCard(player: Player, position: { col: number; row: number }): {
        gameState?: SkyjoGameState;
        roomId?: string;
        roundEnd?: { playerId: string; roundScore: number; totalScore: number }[];
        gameEnd?: { playerId: string; username: string; score: number };
        error?: string
    } {
        const roomId = this.playerRooms.get(player.id);
        if (!roomId) return { error: 'Partie introuvable' };

        const game = this.skyjoGames.get(roomId);
        if (!game) return { error: 'Jeu non trouvé' };

        const result = game.swapCard(player.id, position);
        if (result.error) return { error: result.error };

        return {
            gameState: game.getState(roomId),
            roomId,
            roundEnd: result.roundEnd,
            gameEnd: result.gameEnd
        };
    }

    /**
     * Défausse la carte piochée et révèle une carte
     */
    skyjoDiscardDrawn(player: Player): { gameState?: SkyjoGameState; roomId?: string; error?: string } {
        const roomId = this.playerRooms.get(player.id);
        if (!roomId) return { error: 'Partie introuvable' };

        const game = this.skyjoGames.get(roomId);
        if (!game) return { error: 'Jeu non trouvé' };

        const result = game.discardDrawnCard(player.id);
        if (result.error) return { error: result.error };

        return { gameState: game.getState(roomId), roomId };
    }

    /**
     * Révèle une carte après avoir défaussé
     */
    skyjoRevealCard(player: Player, position: { col: number; row: number }): {
        gameState?: SkyjoGameState;
        roomId?: string;
        roundEnd?: { playerId: string; roundScore: number; totalScore: number }[];
        gameEnd?: { playerId: string; username: string; score: number };
        error?: string
    } {
        const roomId = this.playerRooms.get(player.id);
        if (!roomId) return { error: 'Partie introuvable' };

        const game = this.skyjoGames.get(roomId);
        if (!game) return { error: 'Jeu non trouvé' };

        const result = game.revealCard(player.id, position);
        if (result.error) return { error: result.error };

        return {
            gameState: game.getState(roomId),
            roomId,
            roundEnd: result.roundEnd,
            gameEnd: result.gameEnd
        };
    }

    /**
     * Passe à la manche suivante
     */
    skyjoNextRound(player: Player): {
        gameState?: SkyjoGameState;
        roomId?: string;
        error?: string
    } {
        const roomId = this.playerRooms.get(player.id);
        if (!roomId) return { error: 'Partie introuvable' };

        const game = this.skyjoGames.get(roomId);
        if (!game) return { error: 'Jeu non trouvé' };

        const result = game.nextRound(player.id);
        if (result.error) return { error: result.error };

        return {
            gameState: game.getState(roomId),
            roomId
        };
    }

    /**
     * Gère la déconnexion d'un joueur
     */
    handleDisconnect(player: Player): { roomId?: string; gameState?: SkyjoGameState } {
        const roomId = this.playerRooms.get(player.id);
        if (!roomId) return {};

        const room = this.rooms.get(roomId);
        if (!room) {
            this.playerRooms.delete(player.id);
            return {};
        }

        // Si une partie est en cours, marquer le joueur comme déconnecté au lieu de le retirer
        if (room.status === 'playing') {
            const game = this.skyjoGames.get(roomId);
            if (game) {
                game.markPlayerDisconnected(player.id);
                return { roomId, gameState: game.getState(roomId) };
            }
        }

        // Sinon, le retirer normalement de la room (en attente)
        const result = this.leaveRoom(player);
        if (result.room) {
            this.io.to(result.room.id).emit('room:updated', result.room);
        }
        return {};
    }
}
