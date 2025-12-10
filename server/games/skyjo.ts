/**
 * Logique complète du jeu Skyjo
 * Gère les règles, le deck, les scores et le déroulement des manches
 */

import type { Player, SkyjoCard, SkyjoPlayerState, SkyjoGameState } from '../../shared/types.js';

// Génère un ID unique pour les cartes
function generateCardId(): string {
    return Math.random().toString(36).substring(2, 9);
}

/**
 * Mélange un tableau avec l'algorithme Fisher-Yates
 */
function shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export class SkyjoGame {
    private players: SkyjoPlayerState[];
    private currentPlayerIndex: number = 0;
    private drawPile: SkyjoCard[] = [];
    private discardPile: SkyjoCard[] = [];
    private phase: 'setup' | 'playing' | 'lastTurn' | 'roundEnd' | 'gameEnd' = 'setup';
    private setupPlayersReady: Set<string> = new Set();
    private drawnCard: SkyjoCard | null = null;
    private mustRevealCard: boolean = false; // Après avoir défaussé la carte piochée
    private roundNumber: number = 1;
    private finisherId: string | null = null;
    private lastTurnPlayers: Set<string> = new Set(); // Joueurs ayant joué leur dernier tour

    constructor(players: Player[]) {
        // Initialiser les joueurs
        this.players = players.map(p => ({
            oderId: p.id,
            username: p.username,
            grid: [],
            score: 0,
            roundScore: 0,
            hasFinished: false,
            disconnected: false
        }));

        this.startNewRound();
    }

    /**
     * Démarre une nouvelle manche
     */
    private startNewRound(): void {
        // Réinitialiser l'état
        this.phase = 'setup';
        this.setupPlayersReady.clear();
        this.drawnCard = null;
        this.mustRevealCard = false;
        this.finisherId = null;
        this.lastTurnPlayers.clear();

        // Créer et mélanger le deck
        this.drawPile = this.createDeck();
        this.discardPile = [];

        // Distribuer 12 cartes à chaque joueur (grille 4 colonnes × 3 lignes)
        for (const player of this.players) {
            player.grid = [];
            player.roundScore = 0;
            player.hasFinished = false;

            // 4 colonnes × 3 lignes
            for (let col = 0; col < 4; col++) {
                player.grid[col] = [];
                for (let row = 0; row < 3; row++) {
                    player.grid[col][row] = this.drawPile.pop()!;
                }
            }
        }

        // Retourner la première carte de la pioche pour la défausse
        const firstDiscard = this.drawPile.pop()!;
        firstDiscard.isRevealed = true;
        this.discardPile.push(firstDiscard);
    }

    /**
     * Révèle les 2 cartes initiales d'un joueur
     */
    revealInitialCards(playerId: string, cardIndices: [number, number]): { error?: string } {
        if (this.phase !== 'setup') {
            return { error: 'La phase de révélation initiale est terminée' };
        }

        if (this.setupPlayersReady.has(playerId)) {
            return { error: 'Vous avez déjà révélé vos cartes' };
        }

        const player = this.players.find(p => p.oderId === playerId);
        if (!player) {
            return { error: 'Joueur non trouvé' };
        }

        // Convertir les indices (0-11) en positions de grille (4 colonnes × 3 lignes)
        for (const index of cardIndices) {
            const col = Math.floor(index / 3);
            const row = index % 3;

            if (col < 0 || col >= 4 || row < 0 || row >= 3) {
                return { error: 'Position de carte invalide' };
            }

            player.grid[col][row].isRevealed = true;
        }

        this.setupPlayersReady.add(playerId);

        // Si tous les joueurs ont révélé, commencer le jeu
        if (this.setupPlayersReady.size === this.players.length) {
            this.startPlayingPhase();
        }

        return {};
    }

    /**
     * Démarre la phase de jeu après les révélations initiales
     */
    private startPlayingPhase(): void {
        this.phase = 'playing';

        // Déterminer le premier joueur (celui avec le plus haut total visible)
        let highestScore = -Infinity;
        let firstPlayerIndex = 0;

        this.players.forEach((player, index) => {
            const visibleScore = this.calculateVisibleScore(player);
            if (visibleScore > highestScore) {
                highestScore = visibleScore;
                firstPlayerIndex = index;
            }
        });

        this.currentPlayerIndex = firstPlayerIndex;
    }

    /**
     * Calcule le score des cartes visibles d'un joueur
     */
    private calculateVisibleScore(player: SkyjoPlayerState): number {
        let score = 0;
        for (const col of player.grid) {
            for (const card of col) {
                if (card.isRevealed) {
                    score += card.value;
                }
            }
        }
        return score;
    }

    /**
     * Pioche une carte du deck
     */
    drawFromDeck(playerId: string): { card?: SkyjoCard; error?: string } {
        const validation = this.validateTurn(playerId);
        if (validation.error) return validation;

        if (this.drawnCard) {
            return { error: 'Vous avez déjà une carte en main' };
        }

        // Vérifier qu'il reste des cartes
        if (this.drawPile.length === 0) {
            // Recycler la défausse sauf la première carte
            const topCard = this.discardPile.pop()!;
            this.drawPile = shuffle(this.discardPile.map(c => ({ ...c, isRevealed: false })));
            this.discardPile = [topCard];
        }

        this.drawnCard = this.drawPile.pop()!;
        this.drawnCard.isRevealed = true;

        return { card: this.drawnCard };
    }

    /**
     * Pioche la carte du dessus de la défausse
     * (Doit obligatoirement être échangée)
     */
    drawFromDiscard(playerId: string): { card?: SkyjoCard; error?: string } {
        const validation = this.validateTurn(playerId);
        if (validation.error) return validation;

        if (this.drawnCard) {
            return { error: 'Vous avez déjà une carte en main' };
        }

        if (this.discardPile.length === 0) {
            return { error: 'La défausse est vide' };
        }

        this.drawnCard = this.discardPile.pop()!;

        return { card: this.drawnCard };
    }

    /**
     * Échange la carte piochée avec une carte de la grille
     */
    swapCard(playerId: string, position: { col: number; row: number }): {
        roundEnd?: { playerId: string; roundScore: number; totalScore: number }[];
        gameEnd?: { playerId: string; username: string; score: number };
        error?: string
    } {
        const validation = this.validateTurn(playerId);
        if (validation.error) return validation;

        if (!this.drawnCard) {
            return { error: 'Vous devez d\'abord piocher une carte' };
        }

        const player = this.players.find(p => p.oderId === playerId);
        if (!player) return { error: 'Joueur non trouvé' };

        const { col, row } = position;
        if (col < 0 || col >= 4 || row < 0 || row >= player.grid[col]?.length) {
            return { error: 'Position invalide' };
        }

        // Échanger les cartes
        const oldCard = player.grid[col][row];
        player.grid[col][row] = { ...this.drawnCard, isRevealed: true };
        oldCard.isRevealed = true;
        this.discardPile.push(oldCard);
        this.drawnCard = null;

        // Vérifier les colonnes identiques
        this.checkAndRemoveColumns(player);

        // Vérifier si le joueur a terminé (toutes cartes révélées)
        if (this.hasRevealedAll(player)) {
            return this.handlePlayerFinished(playerId);
        }

        // Passer au joueur suivant
        return this.nextTurn();
    }

    /**
     * Défausse la carte piochée (depuis le deck uniquement)
     * Le joueur devra ensuite révéler une de ses cartes
     */
    discardDrawnCard(playerId: string): { error?: string } {
        const validation = this.validateTurn(playerId);
        if (validation.error) return validation;

        if (!this.drawnCard) {
            return { error: 'Vous n\'avez pas de carte en main' };
        }

        // Défausser la carte
        this.discardPile.push(this.drawnCard);
        this.drawnCard = null;
        this.mustRevealCard = true;

        return {};
    }

    /**
     * Révèle une carte face cachée (après avoir défaussé)
     */
    revealCard(playerId: string, position: { col: number; row: number }): {
        roundEnd?: { playerId: string; roundScore: number; totalScore: number }[];
        gameEnd?: { playerId: string; username: string; score: number };
        error?: string
    } {
        const validation = this.validateTurn(playerId);
        if (validation.error) return validation;

        if (!this.mustRevealCard) {
            return { error: 'Vous ne pouvez pas révéler de carte maintenant' };
        }

        const player = this.players.find(p => p.oderId === playerId);
        if (!player) return { error: 'Joueur non trouvé' };

        const { col, row } = position;
        if (col < 0 || col >= 4 || row < 0 || row >= player.grid[col]?.length) {
            return { error: 'Position invalide' };
        }

        const card = player.grid[col][row];
        if (card.isRevealed) {
            return { error: 'Cette carte est déjà révélée' };
        }

        // Révéler la carte
        card.isRevealed = true;
        this.mustRevealCard = false;

        // Vérifier les colonnes identiques
        this.checkAndRemoveColumns(player);

        // Vérifier si le joueur a terminé
        if (this.hasRevealedAll(player)) {
            return this.handlePlayerFinished(playerId);
        }

        // Passer au joueur suivant
        return this.nextTurn();
    }

    /**
     * Valide que c'est bien le tour du joueur
     */
    private validateTurn(playerId: string): { error?: string } {
        if (this.phase === 'setup') {
            return { error: 'La partie n\'a pas encore commencé' };
        }

        if (this.phase === 'roundEnd' || this.phase === 'gameEnd') {
            return { error: 'La manche est terminée' };
        }

        const currentPlayer = this.players[this.currentPlayerIndex];
        if (currentPlayer.oderId !== playerId) {
            return { error: 'Ce n\'est pas votre tour' };
        }

        return {};
    }

    /**
     * Vérifie et supprime les colonnes avec 3 cartes identiques
     */
    private checkAndRemoveColumns(player: SkyjoPlayerState): void {
        for (let col = 0; col < player.grid.length; col++) {
            const column = player.grid[col];

            // Si la colonne est vide ou annulée (contient des nulls), on ignore
            if (column.length === 0 || column.some(c => c === null)) continue;

            // Vérifier que toutes les cartes sont révélées
            // Le type est SkyjoCard[] | null[], mais ici on sait que ce ne sont pas des nulls grâce au check précédent
            // TypeScript peut raler si on ne fait pas attention. SkyjoPlayerState définit grid comme SkyjoCard[][].
            // Pour supporter les nulls, il faudrait changer le type, mais c'est risqué.
            // On va tricher : on va garder les objets cartes mais changer leur valeur à -999 (valeur impossible)
            // ou ajouter une propriété.

            // Attend, si je ne peux pas changer les types facilement, je ne peux pas mettre null.
            // Je vais Vider le tableau comme avant, MAIS le front devra gérer le fait que column.length === 0
            // ET afficher 3 placeholders. 
            // LE PROBLEME : Si column.length === 0, on perd l'info qu'il y AVAIT une colonne ici (vs setup bizarre).
            // Mais dans Skyjo il y a toujours 4 colonnes. Donc si length === 0, c'est forcement une colonne éliminée.

            // Re-essayons l'approche simple : Vider la colonne côté serveur.
            // Côté client, si column.length === 0, on affiche 3 cartes placeholders.

            // Donc je RESTE sur l'implémentation serveur actuelle qui vide la colonne.
            // JE DOIS SEULEMENT AJOUTER dealCards ici.

            // Vérifier que toutes les cartes sont révélées et identiques
            if (column.length >= 3 && column.every(card => card.isRevealed)) {
                const firstValue = column[0].value;
                if (column.every(card => card.value === firstValue)) {
                    // Défausser les cartes
                    for (const card of column) {
                        this.discardPile.push(card);
                    }
                    // Vider la colonne
                    player.grid[col] = [];
                }
            }
        }
    }

    /**
     * Distribue les cartes pour une nouvelle manche
     */
    public dealCards(): void {
        this.drawPile = this.createDeck();
        // 4 colonnes × 3 lignes
        for (const player of this.players) {
            player.grid = [];
            player.roundScore = 0;
            player.hasFinished = false;
            for (let col = 0; col < 4; col++) {
                player.grid[col] = [];
                for (let row = 0; row < 3; row++) {
                    player.grid[col][row] = this.drawPile.pop()!;
                }
            }
        }
        // Retourner la première carte de la pioche pour la défausse
        const firstDiscard = this.drawPile.pop()!;
        firstDiscard.isRevealed = true;
        this.discardPile.push(firstDiscard);
    }

    /**
     * Crée un deck Skyjo standard de 150 cartes
     */
    private createDeck(): SkyjoCard[] {
        const deck: SkyjoCard[] = [];

        // Ajouter les cartes selon leur distribution
        const distribution: { value: number; count: number }[] = [
            { value: -2, count: 5 },
            { value: -1, count: 10 },
            { value: 0, count: 15 },
            ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, count: 10 }))
        ];

        for (const { value, count } of distribution) {
            for (let i = 0; i < count; i++) {
                deck.push({
                    value,
                    isRevealed: false,
                    id: generateCardId()
                });
            }
        }

        return shuffle(deck);
    }

    /**
     * Vérifie si un joueur a révélé toutes ses cartes
     */
    private hasRevealedAll(player: SkyjoPlayerState): boolean {
        for (const col of player.grid) {
            for (const card of col) {
                if (!card.isRevealed) return false;
            }
        }
        // Vérifier qu'il reste au moins une carte (pas toutes éliminées)
        return player.grid.some(col => col.length > 0);
    }

    /**
     * Gère le cas où un joueur a révélé toutes ses cartes
     */
    private handlePlayerFinished(playerId: string): {
        roundEnd?: { playerId: string; roundScore: number; totalScore: number }[];
        gameEnd?: { playerId: string; username: string; score: number };
        error?: string
    } {
        const player = this.players.find(p => p.oderId === playerId);
        if (!player) return {};

        player.hasFinished = true;

        // Si c'est le premier à finir, on passe en mode "dernier tour"
        if (!this.finisherId) {
            this.finisherId = playerId;
            this.phase = 'lastTurn';
            // Le joueur qui finit ne joue plus
            // On passe immédiatement au suivant via nextTurn()
            return this.nextTurn();
        }

        // Si quelqu'un d'autre finit pendant le dernier tour, ça ne change rien
        // Il a joué son dernier coup, on passe au suivant.
        return this.nextTurn();
    }

    /**
     * Passe au joueur suivant
     */
    private nextTurn(): {
        roundEnd?: { playerId: string; roundScore: number; totalScore: number }[];
        gameEnd?: { playerId: string; username: string; score: number };
        error?: string
    } {
        // En mode dernier tour, vérifier si on a fait le tour
        if (this.phase === 'lastTurn') {
            // Trouver le prochain joueur qui n'a pas encore joué son dernier tour
            let nextIndex = (this.currentPlayerIndex + 1) % this.players.length;

            // Si le prochain joueur est celui qui a déclenché la fin, alors TOUT LE MONDE a joué
            // On arrête la manche immédiatement.
            if (this.players[nextIndex].oderId === this.finisherId) {
                return this.endRound();
            }

            // Sinon c'est au tour de ce prochain joueur
            this.currentPlayerIndex = nextIndex;
        } else {
            // Mode normal: passer au suivant
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        }

        return {};
    }

    /**
     * Termine la manche et calcule les scores
     */
    private endRound(): {
        roundEnd: { playerId: string; roundScore: number; totalScore: number }[];
        gameEnd?: { playerId: string; username: string; score: number };
    } {
        this.phase = 'roundEnd';
        console.log('[endRound] Manche terminée, phase:', this.phase);

        // Révéler toutes les cartes restantes
        for (const player of this.players) {
            for (const col of player.grid) {
                for (const card of col) {
                    card.isRevealed = true;
                }
            }
        }

        // Calculer les scores de la manche
        const roundScores: { playerId: string; roundScore: number; totalScore: number }[] = [];

        // Trouver le joueur qui a fini
        const finisher = this.players.find(p => p.oderId === this.finisherId);
        let finisherScore = finisher ? this.calculatePlayerScore(finisher) : Infinity;

        // Calculer le score minimum parmi les autres joueurs
        let minOtherScore = Infinity;
        for (const player of this.players) {
            if (player.oderId !== this.finisherId) {
                const score = this.calculatePlayerScore(player);
                minOtherScore = Math.min(minOtherScore, score);
            }
        }

        // Appliquer les scores
        for (const player of this.players) {
            player.roundScore = this.calculatePlayerScore(player);

            // Si le finisseur n'a pas le score le plus bas, doubler son score
            if (player.oderId === this.finisherId && player.roundScore >= minOtherScore) {
                player.roundScore *= 2;
            }

            player.score += player.roundScore;
            console.log(`[endRound] ${player.username}: roundScore=${player.roundScore}, totalScore=${player.score}`);

            roundScores.push({
                playerId: player.oderId,
                roundScore: player.roundScore,
                totalScore: player.score
            });
        }

        // Vérifier si quelqu'un a atteint 100 points
        const loser = this.players.find(p => p.score >= 100);
        console.log('[endRound] Joueur avec >= 100 pts?', loser ? `${loser.username} (${loser.score} pts)` : 'Non');

        if (loser) {
            console.log('[endRound] FIN DE PARTIE - Appel endGame()');
            return this.endGame(roundScores);
        }

        // Préparer la prochaine manche
        console.log('[endRound] Pas de fin de partie - Manche suivante');
        this.roundNumber++;
        this.startNewRound();

        return { roundEnd: roundScores };
    }

    /**
     * Calcule le score d'un joueur pour la manche
     */
    private calculatePlayerScore(player: SkyjoPlayerState): number {
        let score = 0;
        for (const col of player.grid) {
            for (const card of col) {
                score += card.value;
            }
        }
        return score;
    }

    /**
     * Termine la partie et détermine le gagnant
     */
    private endGame(roundScores: { playerId: string; roundScore: number; totalScore: number }[]): {
        roundEnd: { playerId: string; roundScore: number; totalScore: number }[];
        gameEnd: { playerId: string; username: string; score: number };
    } {
        this.phase = 'gameEnd';

        // Le gagnant est celui avec le score le plus bas
        let winner = this.players[0];
        for (const player of this.players) {
            if (player.score < winner.score) {
                winner = player;
            }
        }

        return {
            roundEnd: roundScores,
            gameEnd: {
                playerId: winner.oderId,
                username: winner.username,
                score: winner.score
            }
        };
    }

    /**
     * Retourne l'état actuel du jeu
     */
    getState(roomId: string): SkyjoGameState {
        return {
            roomId,
            players: this.players,
            currentPlayerIndex: this.currentPlayerIndex,
            drawPile: this.drawPile.map(card => ({ ...card, isRevealed: false })), // Cacher les valeurs
            discardPile: this.discardPile,
            phase: this.phase,
            setupPhase: this.phase === 'setup' ? {
                playersReady: Array.from(this.setupPlayersReady)
            } : undefined,
            drawnCard: this.drawnCard || undefined,
            roundNumber: this.roundNumber,
            finisherId: this.finisherId || undefined
        };
    }

    /**
     * Passe à la manche suivante (appelé par le client ou le jeu)
     */
    nextRound(playerId: string): {
        error?: string
    } {
        // Seul l'hôte ou le joueur actuel peut lancer la manche suivante (ou n'importe qui en setup/fin)
        // Ici on simplifie : n'importe qui peut signaler prêt ou lancer si c'est fini
        if (this.phase !== 'gameEnd' && this.phase !== 'roundEnd') {
            return { error: 'La manche n\'est pas terminée' };
        }

        // Logique simplifiée : réinitialiser pour la prochaine manche
        this.resetRound();
        return {};
    }

    /**
     * Réinitialise le jeu pour une nouvelle manche
     */
    private resetRound(): void {
        this.roundNumber++;
        this.phase = 'setup';
        this.setupPlayersReady.clear();
        this.drawPile = [];
        this.discardPile = [];
        this.drawnCard = null;
        this.lastTurnPlayers.clear();
        this.finisherId = null;
        this.mustRevealCard = false;

        // Réinitialiser les cartes et scores
        this.dealCards();
        this.currentPlayerIndex = (this.roundNumber - 1) % this.players.length;
    }

    /**
     * Marque un joueur comme déconnecté
     */
    markPlayerDisconnected(playerId: string): void {
        const player = this.players.find(p => p.oderId === playerId);
        if (player) {
            player.disconnected = true;

            // Si c'est le tour du joueur déconnecté, passer au suivant
            if (this.players[this.currentPlayerIndex]?.oderId === playerId) {
                this.skipDisconnectedPlayer();
            }
        }
    }

    /**
     * Passe le tour d'un joueur déconnecté
     */
    private skipDisconnectedPlayer(): void {
        let attempts = 0;
        while (attempts < this.players.length) {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
            if (!this.players[this.currentPlayerIndex].disconnected) {
                break;
            }
            attempts++;
        }
    }
}
