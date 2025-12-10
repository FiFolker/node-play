/**
 * Intelligence Artificielle pour le jeu Skyjo
 * Trois niveaux de difficulté : Easy, Medium, Hard
 */

import type { SkyjoCard, SkyjoPlayerState, BotDifficulty } from '../../shared/types.js';

type AIAction =
    | { action: 'drawDeck' }
    | { action: 'drawDiscard' }
    | { action: 'swap'; col: number; row: number }
    | { action: 'discard' }
    | { action: 'reveal'; col: number; row: number };

export class SkyjoAI {
    /**
     * Choisit 2 cartes à révéler en début de partie
     */
    static chooseInitialCards(difficulty: BotDifficulty = 'medium'): [number, number] {
        switch (difficulty) {
            case 'easy':
                // Choix aléatoire
                const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
                const shuffled = indices.sort(() => Math.random() - 0.5);
                return [shuffled[0], shuffled[1]];
            case 'medium':
                // Révéler les coins opposés (diagonale)
                return [0, 11];
            case 'hard':
                // Révéler des positions stratégiques (milieu des colonnes)
                return [4, 7]; // Centre pour mieux évaluer les colonnes
        }
    }

    /**
     * Décide de l'action à effectuer lors du tour
     */
    static decideTurn(
        player: SkyjoPlayerState,
        topDiscard: SkyjoCard | null,
        drawnCard: SkyjoCard | null,
        difficulty: BotDifficulty = 'medium',
        allPlayers?: SkyjoPlayerState[]
    ): AIAction {
        switch (difficulty) {
            case 'easy':
                return this.decideTurnEasy(player, topDiscard, drawnCard);
            case 'medium':
                return this.decideTurnMedium(player, topDiscard, drawnCard);
            case 'hard':
                return this.decideTurnHard(player, topDiscard, drawnCard, allPlayers || []);
        }
    }

    // ============================================
    // EASY MODE - Décisions aléatoires/suboptimales
    // ============================================

    private static decideTurnEasy(
        player: SkyjoPlayerState,
        topDiscard: SkyjoCard | null,
        drawnCard: SkyjoCard | null
    ): AIAction {
        if (!drawnCard) {
            // 70% pioche, même si défausse intéressante
            if (Math.random() < 0.7) {
                return { action: 'drawDeck' };
            }
            if (topDiscard) {
                return { action: 'drawDiscard' };
            }
            return { action: 'drawDeck' };
        }

        // Décision aléatoire pour échanger ou défausser
        if (Math.random() < 0.5) {
            // 50% chance de défausser même si la carte est bonne
            return { action: 'discard' };
        }

        // Échanger avec une carte au hasard
        const hiddenCards = this.getHiddenCards(player);
        const revealedCards = this.getRevealedCards(player);

        if (Math.random() < 0.6 && hiddenCards.length > 0) {
            const idx = Math.floor(Math.random() * hiddenCards.length);
            return { action: 'swap', ...hiddenCards[idx] };
        } else if (revealedCards.length > 0) {
            const idx = Math.floor(Math.random() * revealedCards.length);
            return { action: 'swap', ...revealedCards[idx].pos };
        }

        return { action: 'discard' };
    }

    // ============================================
    // MEDIUM MODE - Stratégie basique (ancien code)
    // ============================================

    private static decideTurnMedium(
        player: SkyjoPlayerState,
        topDiscard: SkyjoCard | null,
        drawnCard: SkyjoCard | null
    ): AIAction {
        if (!drawnCard) {
            // Prendre la défausse si la carte est bonne (≤ 4)
            if (topDiscard && topDiscard.value <= 4) {
                return { action: 'drawDiscard' };
            }
            return { action: 'drawDeck' };
        }

        const bestSwapPosition = this.findBestSwapPosition(player, drawnCard);
        if (bestSwapPosition) {
            return { action: 'swap', ...bestSwapPosition };
        }
        return { action: 'discard' };
    }

    // ============================================
    // HARD MODE - Stratégie avancée avec analyse
    // ============================================

    private static decideTurnHard(
        player: SkyjoPlayerState,
        topDiscard: SkyjoCard | null,
        drawnCard: SkyjoCard | null,
        allPlayers: SkyjoPlayerState[]
    ): AIAction {
        if (!drawnCard) {
            return this.decideDrawHard(player, topDiscard, allPlayers);
        }
        return this.decideSwapHard(player, drawnCard, allPlayers);
    }

    private static decideDrawHard(
        player: SkyjoPlayerState,
        topDiscard: SkyjoCard | null,
        allPlayers: SkyjoPlayerState[]
    ): AIAction {
        if (!topDiscard) return { action: 'drawDeck' };

        const myScore = this.calculateVisibleScore(player);
        const lowestOpponentScore = this.getLowestOpponentScore(player, allPlayers);
        const amWinning = myScore < lowestOpponentScore;

        // Analyser si la carte de la défausse nous aide
        const discardValue = topDiscard.value;

        // Cartes négatives ou 0 : toujours prendre
        if (discardValue <= 0) {
            return { action: 'drawDiscard' };
        }

        // Chercher une opportunité de compléter une colonne
        const columnMatch = this.findColumnMatchOpportunity(player, discardValue);
        if (columnMatch) {
            return { action: 'drawDiscard' };
        }

        // Si on gagne, être plus conservateur
        if (amWinning) {
            if (discardValue <= 2) return { action: 'drawDiscard' };
            return { action: 'drawDeck' };
        }

        // Si on perd, prendre plus de risques
        if (discardValue <= 5) {
            return { action: 'drawDiscard' };
        }

        return { action: 'drawDeck' };
    }

    private static decideSwapHard(
        player: SkyjoPlayerState,
        drawnCard: SkyjoCard,
        allPlayers: SkyjoPlayerState[]
    ): AIAction {
        const drawnValue = drawnCard.value;

        // Priorité 1: Compléter une colonne (élimination de 3 cartes identiques)
        const columnSwap = this.findColumnCompletionSwap(player, drawnValue);
        if (columnSwap) {
            return { action: 'swap', ...columnSwap };
        }

        // Priorité 2: Remplacer une carte haute révélée
        const highCardSwap = this.findHighCardReplacement(player, drawnValue);
        if (highCardSwap) {
            return { action: 'swap', ...highCardSwap };
        }

        // Priorité 3: Pour les très bonnes cartes, remplacer une carte cachée
        if (drawnValue <= 2) {
            const hiddenSwap = this.findStrategicHiddenSwap(player, drawnValue);
            if (hiddenSwap) {
                return { action: 'swap', ...hiddenSwap };
            }
        }

        // Priorité 4: Évaluer si on doit finir vite
        const myScore = this.calculateVisibleScore(player);
        const lowestOpponent = this.getLowestOpponentScore(player, allPlayers);
        const hiddenCount = this.countHiddenCards(player);

        // Si on a peu de cartes cachées et on gagne, révéler au lieu d'échanger
        if (hiddenCount <= 3 && myScore < lowestOpponent && drawnValue >= 5) {
            return { action: 'discard' };
        }

        // Échange avec carte cachée si la carte est décente
        if (drawnValue <= 4) {
            const hidden = this.getHiddenCards(player);
            if (hidden.length > 0) {
                // Choisir stratégiquement (éviter colonnes prometteuses)
                const best = this.pickBestHiddenToReplace(player, hidden);
                return { action: 'swap', ...best };
            }
        }

        return { action: 'discard' };
    }

    // ============================================
    // HELPERS - Analyse des colonnes
    // ============================================

    private static findColumnMatchOpportunity(
        player: SkyjoPlayerState,
        value: number
    ): { col: number; row: number } | null {
        for (let col = 0; col < player.grid.length; col++) {
            const column = player.grid[col];
            if (column.length === 0) continue;

            const revealedWithValue = column.filter(c => c.isRevealed && c.value === value);
            const hidden = column.filter(c => !c.isRevealed);

            // Si 2 cartes de même valeur révélées et 1 cachée
            if (revealedWithValue.length === 2 && hidden.length === 1) {
                const rowIdx = column.findIndex(c => !c.isRevealed);
                return { col, row: rowIdx };
            }
        }
        return null;
    }

    private static findColumnCompletionSwap(
        player: SkyjoPlayerState,
        value: number
    ): { col: number; row: number } | null {
        for (let col = 0; col < player.grid.length; col++) {
            const column = player.grid[col];
            if (column.length === 0) continue;

            let matchCount = 0;
            let differentIdx = -1;

            for (let row = 0; row < column.length; row++) {
                const card = column[row];
                if (card.isRevealed) {
                    if (card.value === value) {
                        matchCount++;
                    } else {
                        differentIdx = row;
                    }
                }
            }

            // Si 2 cartes identiques à la valeur piochée et 1 différente
            if (matchCount === 2 && differentIdx >= 0) {
                return { col, row: differentIdx };
            }
        }
        return null;
    }

    private static findHighCardReplacement(
        player: SkyjoPlayerState,
        drawnValue: number
    ): { col: number; row: number } | null {
        let bestPos: { col: number; row: number } | null = null;
        let bestImprovement = 0;

        for (let col = 0; col < player.grid.length; col++) {
            for (let row = 0; row < player.grid[col].length; row++) {
                const card = player.grid[col][row];
                if (card.isRevealed) {
                    const improvement = card.value - drawnValue;
                    if (improvement > bestImprovement) {
                        bestImprovement = improvement;
                        bestPos = { col, row };
                    }
                }
            }
        }

        // Seuil minimum d'amélioration
        if (bestImprovement >= 3) {
            return bestPos;
        }
        return null;
    }

    private static findStrategicHiddenSwap(
        player: SkyjoPlayerState,
        drawnValue: number
    ): { col: number; row: number } | null {
        // Pour les bonnes cartes, cibler les colonnes sans potentiel d'élimination
        const hiddenCards = this.getHiddenCards(player);
        if (hiddenCards.length === 0) return null;

        for (const pos of hiddenCards) {
            const column = player.grid[pos.col];
            const revealedValues = column
                .filter(c => c.isRevealed)
                .map(c => c.value);

            // Éviter les colonnes où on pourrait faire un triplet
            const hasMatchPotential = revealedValues.some(v =>
                revealedValues.filter(x => x === v).length >= 2
            );

            if (!hasMatchPotential) {
                return pos;
            }
        }

        return hiddenCards[0];
    }

    private static pickBestHiddenToReplace(
        player: SkyjoPlayerState,
        hiddenCards: { col: number; row: number }[]
    ): { col: number; row: number } {
        // Préférer les colonnes avec des valeurs hautes
        let best = hiddenCards[0];
        let worstColumnScore = -Infinity;

        for (const pos of hiddenCards) {
            const columnScore = player.grid[pos.col]
                .filter(c => c.isRevealed)
                .reduce((sum, c) => sum + c.value, 0);

            if (columnScore > worstColumnScore) {
                worstColumnScore = columnScore;
                best = pos;
            }
        }

        return best;
    }

    // ============================================
    // HELPERS - Utilitaires généraux
    // ============================================

    private static calculateVisibleScore(player: SkyjoPlayerState): number {
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

    private static getLowestOpponentScore(
        player: SkyjoPlayerState,
        allPlayers: SkyjoPlayerState[]
    ): number {
        let lowest = Infinity;
        for (const p of allPlayers) {
            if (p.oderId !== player.oderId) {
                const score = this.calculateVisibleScore(p);
                if (score < lowest) lowest = score;
            }
        }
        return lowest === Infinity ? 0 : lowest;
    }

    private static countHiddenCards(player: SkyjoPlayerState): number {
        let count = 0;
        for (const col of player.grid) {
            for (const card of col) {
                if (!card.isRevealed) count++;
            }
        }
        return count;
    }

    private static getHiddenCards(player: SkyjoPlayerState): { col: number; row: number }[] {
        const result: { col: number; row: number }[] = [];
        for (let col = 0; col < player.grid.length; col++) {
            for (let row = 0; row < player.grid[col].length; row++) {
                if (!player.grid[col][row].isRevealed) {
                    result.push({ col, row });
                }
            }
        }
        return result;
    }

    private static getRevealedCards(player: SkyjoPlayerState): { card: SkyjoCard; pos: { col: number; row: number } }[] {
        const result: { card: SkyjoCard; pos: { col: number; row: number } }[] = [];
        for (let col = 0; col < player.grid.length; col++) {
            for (let row = 0; row < player.grid[col].length; row++) {
                if (player.grid[col][row].isRevealed) {
                    result.push({ card: player.grid[col][row], pos: { col, row } });
                }
            }
        }
        return result;
    }

    /**
     * Trouve la meilleure position pour échanger une carte (Medium mode)
     */
    private static findBestSwapPosition(
        player: SkyjoPlayerState,
        drawnCard: SkyjoCard
    ): { col: number; row: number } | null {
        const drawnValue = drawnCard.value;
        let bestPosition: { col: number; row: number } | null = null;
        let bestImprovement = 0;

        for (let col = 0; col < player.grid.length; col++) {
            for (let row = 0; row < player.grid[col].length; row++) {
                const card = player.grid[col][row];

                if (card.isRevealed) {
                    const improvement = card.value - drawnValue;
                    if (improvement > bestImprovement) {
                        bestImprovement = improvement;
                        bestPosition = { col, row };
                    }
                } else {
                    // Estimation: valeur moyenne d'une carte cachée ≈ 5
                    if (drawnValue <= 2) {
                        const estimatedImprovement = 5 - drawnValue;
                        if (estimatedImprovement > bestImprovement) {
                            bestImprovement = estimatedImprovement;
                            bestPosition = { col, row };
                        }
                    }
                }
            }
        }

        if (bestImprovement >= 3 || (drawnValue <= 0 && bestPosition)) {
            return bestPosition;
        }

        // Cartes hautes: défausser
        if (drawnValue >= 9) return null;

        // Cartes moyennes (5-8): échanger avec carte ≥ 10
        if (drawnValue >= 5 && drawnValue <= 8) {
            for (let col = 0; col < player.grid.length; col++) {
                for (let row = 0; row < player.grid[col].length; row++) {
                    const card = player.grid[col][row];
                    if (card.isRevealed && card.value >= 10) {
                        return { col, row };
                    }
                }
            }
        }

        // Cartes basses (3-4): échanger avec carte ≥ 8
        if (drawnValue >= 3 && drawnValue <= 4) {
            for (let col = 0; col < player.grid.length; col++) {
                for (let row = 0; row < player.grid[col].length; row++) {
                    const card = player.grid[col][row];
                    if (card.isRevealed && card.value >= 8) {
                        return { col, row };
                    }
                }
            }
            const hidden = this.getHiddenCards(player);
            return hidden.length > 0 ? hidden[0] : null;
        }

        // Très bonnes cartes (≤ 2): toujours échanger
        if (drawnValue <= 2) {
            for (let col = 0; col < player.grid.length; col++) {
                for (let row = 0; row < player.grid[col].length; row++) {
                    const card = player.grid[col][row];
                    if (card.isRevealed && card.value >= 5) {
                        return { col, row };
                    }
                }
            }
            const hidden = this.getHiddenCards(player);
            return hidden.length > 0 ? hidden[0] : null;
        }

        return null;
    }

    /**
     * Trouve une carte à révéler après avoir défaussé
     */
    static chooseCardToReveal(
        player: SkyjoPlayerState,
        difficulty: BotDifficulty = 'medium'
    ): { col: number; row: number } {
        const hiddenCards = this.getHiddenCards(player);
        if (hiddenCards.length === 0) {
            return { col: 0, row: 0 };
        }

        switch (difficulty) {
            case 'easy':
                // Complètement aléatoire
                return hiddenCards[Math.floor(Math.random() * hiddenCards.length)];

            case 'medium':
                // Aléatoire
                return hiddenCards[Math.floor(Math.random() * hiddenCards.length)];

            case 'hard':
                // Choisir stratégiquement : révéler là où on a des paires potentielles
                for (const pos of hiddenCards) {
                    const column = player.grid[pos.col];
                    const revealedValues = column.filter(c => c.isRevealed).map(c => c.value);
                    // Si 2 cartes de même valeur dans la colonne
                    if (revealedValues.length === 2 && revealedValues[0] === revealedValues[1]) {
                        return pos;
                    }
                }
                return hiddenCards[Math.floor(Math.random() * hiddenCards.length)];
        }
    }

    /**
     * Génère un nom pour un bot selon la difficulté
     */
    static generateBotName(index: number, difficulty: BotDifficulty = 'medium'): string {
        const prefixes = {
            'easy': ['Newbie', 'Rookie', 'Noob', 'Débutant'],
            'medium': ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta'],
            'hard': ['Master', 'Expert', 'Pro', 'Champion']
        };
        const names = prefixes[difficulty];
        return names[index % names.length] || `Bot ${index + 1}`;
    }

    /**
     * Génère un ID unique pour un bot
     */
    static generateBotId(): string {
        return `bot_${Math.random().toString(36).substring(2, 9)}`;
    }
}
