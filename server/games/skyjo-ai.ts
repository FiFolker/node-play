/**
 * Intelligence Artificielle pour le jeu Skyjo
 * Stratégie simple mais efficace pour les bots
 */

import type { SkyjoCard, SkyjoPlayerState } from '../../shared/types.js';

export class SkyjoAI {
    /**
     * Choisit 2 cartes à révéler en début de partie
     * Stratégie: révéler les coins opposés (diagonale)
     */
    static chooseInitialCards(): [number, number] {
        // Révéler coin haut-gauche (0) et coin bas-droite (11)
        // Grille 4x3: indices 0,1,2 | 3,4,5 | 6,7,8 | 9,10,11
        return [0, 11];
    }

    /**
     * Décide de l'action à effectuer lors du tour
     */
    static decideTurn(
        player: SkyjoPlayerState,
        topDiscard: SkyjoCard | null,
        drawnCard: SkyjoCard | null
    ):
        | { action: 'drawDeck' }
        | { action: 'drawDiscard' }
        | { action: 'swap'; col: number; row: number }
        | { action: 'discard' }
        | { action: 'reveal'; col: number; row: number } {
        // Si on n'a pas encore pioché
        if (!drawnCard) {
            // Stratégie: prendre la défausse si la carte est bonne (≤ 4)
            if (topDiscard && topDiscard.value <= 4) {
                return { action: 'drawDiscard' };
            }
            return { action: 'drawDeck' };
        }

        // On a une carte en main, décider quoi faire
        const bestSwapPosition = this.findBestSwapPosition(player, drawnCard);

        if (bestSwapPosition) {
            return { action: 'swap', ...bestSwapPosition };
        }

        // La carte n'améliore pas notre jeu, la défausser
        return { action: 'discard' };
    }

    /**
     * Trouve la meilleure carte à révéler après avoir défaussé
     */
    static chooseCardToReveal(player: SkyjoPlayerState): { col: number; row: number } {
        // Révéler une carte cachée au hasard, en préférant les positions centrales
        const hiddenCards: { col: number; row: number }[] = [];

        for (let col = 0; col < player.grid.length; col++) {
            for (let row = 0; row < player.grid[col].length; row++) {
                if (!player.grid[col][row].isRevealed) {
                    hiddenCards.push({ col, row });
                }
            }
        }

        if (hiddenCards.length === 0) {
            return { col: 0, row: 0 }; // Fallback
        }

        // Prendre une carte cachée au hasard
        const randomIndex = Math.floor(Math.random() * hiddenCards.length);
        return hiddenCards[randomIndex];
    }

    /**
     * Trouve la meilleure position pour échanger une carte
     * Retourne null si l'échange n'est pas avantageux
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
                    // Carte révélée: échanger si on améliore
                    const improvement = card.value - drawnValue;
                    if (improvement > bestImprovement) {
                        bestImprovement = improvement;
                        bestPosition = { col, row };
                    }
                } else {
                    // Carte cachée: échanger si la carte piochée est bonne
                    // Estimation: valeur moyenne d'une carte cachée ≈ 5
                    const estimatedImprovement = 5 - drawnValue;

                    // Seulement si c'est une très bonne carte (≤ 2)
                    if (drawnValue <= 2 && estimatedImprovement > bestImprovement) {
                        bestImprovement = estimatedImprovement;
                        bestPosition = { col, row };
                    }
                }
            }
        }

        // Échanger seulement si c'est significativement mieux
        if (bestImprovement >= 3 || (drawnValue <= 0 && bestPosition)) {
            return bestPosition;
        }

        // Si la carte piochée est haute (≥ 9), toujours la défausser
        if (drawnValue >= 9) {
            return null;
        }

        // Pour les cartes moyennes (5-8), échanger avec une carte haute révélée
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

        // Pour les cartes basses (3-4), échanger avec une carte ≥ 8
        if (drawnValue >= 3 && drawnValue <= 4) {
            for (let col = 0; col < player.grid.length; col++) {
                for (let row = 0; row < player.grid[col].length; row++) {
                    const card = player.grid[col][row];
                    if (card.isRevealed && card.value >= 8) {
                        return { col, row };
                    }
                }
            }
            // Ou échanger avec une carte cachée
            return this.findHiddenCard(player);
        }

        // Pour les très bonnes cartes (≤ 2), toujours échanger
        if (drawnValue <= 2) {
            // Priorité: carte haute révélée
            for (let col = 0; col < player.grid.length; col++) {
                for (let row = 0; row < player.grid[col].length; row++) {
                    const card = player.grid[col][row];
                    if (card.isRevealed && card.value >= 5) {
                        return { col, row };
                    }
                }
            }
            // Sinon carte cachée
            return this.findHiddenCard(player);
        }

        return null;
    }

    /**
     * Trouve une carte cachée à échanger
     */
    private static findHiddenCard(player: SkyjoPlayerState): { col: number; row: number } | null {
        for (let col = 0; col < player.grid.length; col++) {
            for (let row = 0; row < player.grid[col].length; row++) {
                if (!player.grid[col][row].isRevealed) {
                    return { col, row };
                }
            }
        }
        return null;
    }

    /**
     * Génère un nom aléatoire pour un bot
     */
    static generateBotName(index: number): string {
        const names = [
            'Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta',
            'Bot Epsilon', 'Bot Zeta', 'Bot Eta', 'Bot Theta'
        ];
        return names[index] || `Bot ${index + 1}`;
    }

    /**
     * Génère un ID unique pour un bot
     */
    static generateBotId(): string {
        return `bot_${Math.random().toString(36).substring(2, 9)}`;
    }
}
