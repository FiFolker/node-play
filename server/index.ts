/**
 * Serveur principal Express + Socket.io
 * Point d'entrée du backend pour le hub de jeux multijoueur
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameManager } from './game-manager.js';
import type { ClientToServerEvents, ServerToClientEvents, Player } from '../shared/types.js';

const PORT = 3000;
const app = express();
const httpServer = createServer(app);

// Configuration Socket.io avec typage fort
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
        origin: '*', // Permet les connexions depuis n'importe quelle IP (réseau local)
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Gestionnaire de parties
const gameManager = new GameManager(io);

// Stockage des joueurs connectés (socket.id -> Player)
const connectedPlayers = new Map<string, Player>();

// ============================================
// Gestion des connexions Socket.io
// ============================================

io.on('connection', (socket) => {
    console.log(`[Connexion] Nouveau client: ${socket.id}`);

    // --- Événements de connexion ---

    socket.on('player:join', (username: string) => {
        // Validation du pseudo
        if (!username || username.trim().length < 2) {
            socket.emit('player:error', 'Le pseudo doit contenir au moins 2 caractères');
            return;
        }

        // Vérifier si le pseudo est déjà pris
        const existingPlayer = Array.from(connectedPlayers.values()).find(
            p => p.username.toLowerCase() === username.trim().toLowerCase()
        );
        if (existingPlayer) {
            socket.emit('player:error', 'Ce pseudo est déjà utilisé');
            return;
        }

        // Créer le joueur
        const player: Player = {
            id: socket.id,
            username: username.trim(),
            isHost: false,
            isReady: false
        };

        connectedPlayers.set(socket.id, player);
        socket.emit('player:connected', player);
        console.log(`[Joueur] ${player.username} connecté`);
    });

    // --- Événements de lobby ---

    socket.on('room:create', (data) => {
        const player = connectedPlayers.get(socket.id);
        if (!player) {
            socket.emit('room:error', 'Vous devez être connecté pour créer une partie');
            return;
        }

        const room = gameManager.createRoom(player, data.name, data.gameType, data.isPrivate);
        socket.join(room.id);
        socket.emit('room:created', room);
        console.log(`[Room] ${player.username} a créé la room "${room.name}" (${room.isPrivate ? 'privée' : 'publique'})`);
    });

    socket.on('room:join', (data) => {
        const player = connectedPlayers.get(socket.id);
        if (!player) {
            socket.emit('room:error', 'Vous devez être connecté pour rejoindre une partie');
            return;
        }

        const result = gameManager.joinRoom(player, data.roomId, data.privateCode);
        if (result.error) {
            socket.emit('room:error', result.error);
            return;
        }

        socket.join(data.roomId);
        socket.emit('room:joined', result.room!);
        io.to(data.roomId).emit('room:updated', result.room!);
        console.log(`[Room] ${player.username} a rejoint "${result.room!.name}"`);
    });

    socket.on('room:leave', () => {
        const player = connectedPlayers.get(socket.id);
        if (!player) return;

        const result = gameManager.leaveRoom(player);
        if (result.room) {
            socket.leave(result.room.id);
            socket.emit('room:left');
            io.to(result.room.id).emit('room:updated', result.room);
            console.log(`[Room] ${player.username} a quitté la room`);
        }
    });

    socket.on('room:ready', () => {
        const player = connectedPlayers.get(socket.id);
        if (!player) return;

        const result = gameManager.toggleReady(player);
        if (result.room) {
            io.to(result.room.id).emit('room:updated', result.room);
        }
    });

    socket.on('room:list', () => {
        const rooms = gameManager.getPublicRooms();
        socket.emit('room:list', rooms);
    });

    socket.on('room:start', () => {
        const player = connectedPlayers.get(socket.id);
        if (!player) return;

        const result = gameManager.startGame(player);
        if (result.error) {
            socket.emit('room:error', result.error);
            return;
        }

        if (result.gameState) {
            io.to(result.room!.id).emit('room:updated', result.room!);
            io.to(result.room!.id).emit('skyjo:state', result.gameState);
            console.log(`[Game] Partie lancée dans la room "${result.room!.name}"`);
        }
    });

    // --- Événements Skyjo ---

    socket.on('skyjo:revealInitial', (cardIndices) => {
        const player = connectedPlayers.get(socket.id);
        if (!player) return;

        const result = gameManager.skyjoRevealInitial(player, cardIndices);
        if (result.error) {
            socket.emit('skyjo:error', result.error);
            return;
        }

        if (result.gameState) {
            io.to(result.roomId!).emit('skyjo:state', result.gameState);
        }
    });

    socket.on('skyjo:drawFromDeck', () => {
        const player = connectedPlayers.get(socket.id);
        if (!player) return;

        const result = gameManager.skyjoDrawFromDeck(player);
        if (result.error) {
            socket.emit('skyjo:error', result.error);
            return;
        }

        if (result.drawnCard) {
            socket.emit('skyjo:cardDrawn', result.drawnCard);
        }
        if (result.gameState) {
            io.to(result.roomId!).emit('skyjo:state', result.gameState);
        }
    });

    socket.on('skyjo:drawFromDiscard', () => {
        const player = connectedPlayers.get(socket.id);
        if (!player) return;

        const result = gameManager.skyjoDrawFromDiscard(player);
        if (result.error) {
            socket.emit('skyjo:error', result.error);
            return;
        }

        if (result.drawnCard) {
            socket.emit('skyjo:cardDrawn', result.drawnCard);
        }
        if (result.gameState) {
            io.to(result.roomId!).emit('skyjo:state', result.gameState);
        }
    });

    socket.on('skyjo:swapCard', (position) => {
        const player = connectedPlayers.get(socket.id);
        if (!player) return;

        const result = gameManager.skyjoSwapCard(player, position);
        if (result.error) {
            socket.emit('skyjo:error', result.error);
            return;
        }

        if (result.gameState) {
            io.to(result.roomId!).emit('skyjo:state', result.gameState);

            // Vérifier fin de manche
            if (result.roundEnd) {
                io.to(result.roomId!).emit('skyjo:roundEnd', result.roundEnd);
            }

            // Vérifier fin de partie
            if (result.gameEnd) {
                io.to(result.roomId!).emit('skyjo:gameEnd', result.gameEnd);
            }
        }
    });

    socket.on('skyjo:discardDrawn', () => {
        const player = connectedPlayers.get(socket.id);
        if (!player) return;

        const result = gameManager.skyjoDiscardDrawn(player);
        if (result.error) {
            socket.emit('skyjo:error', result.error);
            return;
        }

        if (result.gameState) {
            io.to(result.roomId!).emit('skyjo:state', result.gameState);
        }
    });

    socket.on('skyjo:revealCard', (position) => {
        const player = connectedPlayers.get(socket.id);
        if (!player) return;

        const result = gameManager.skyjoRevealCard(player, position);
        if (result.error) {
            socket.emit('skyjo:error', result.error);
            return;
        }

        if (result.gameState) {
            io.to(result.roomId!).emit('skyjo:state', result.gameState);

            // Vérifier fin de manche
            if (result.roundEnd) {
                io.to(result.roomId!).emit('skyjo:roundEnd', result.roundEnd);
            }

            // Vérifier fin de partie
            if (result.gameEnd) {
                io.to(result.roomId!).emit('skyjo:gameEnd', result.gameEnd);
            }
        }
    });

    // --- Déconnexion ---

    socket.on('disconnect', () => {
        const player = connectedPlayers.get(socket.id);
        if (player) {
            const result = gameManager.handleDisconnect(player);

            // Si une partie est en cours, émettre le nouvel état avec le joueur marqué déconnecté
            if (result.gameState && result.roomId) {
                io.to(result.roomId).emit('skyjo:state', result.gameState);
            }

            connectedPlayers.delete(socket.id);
            console.log(`[Déconnexion] ${player.username}`);
        }
    });
});

// ============================================
// Routes HTTP (pour le health check)
// ============================================

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', players: connectedPlayers.size });
});

// ============================================
// Mode Production: servir les fichiers Angular
// ============================================

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { networkInterfaces } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Fonction pour obtenir l'IP locale
function getLocalIP(): string {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

// En production, servir les fichiers statiques Angular
// dist/server/index.js -> remonter 2 niveaux -> client/dist/client/browser
const clientPath = join(__dirname, '..', '..', 'client', 'dist', 'client', 'browser');
app.use(express.static(clientPath));

// Route fallback pour le router Angular
app.get('*', (req, res) => {
    res.sendFile(join(clientPath, 'index.html'));
});

// ============================================
// Démarrage du serveur
// ============================================

const localIP = getLocalIP();

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║          🎮 HUB DE JEUX MULTIJOUEUR 🎮            ║
╠═══════════════════════════════════════════════════╣
║  Serveur démarré sur le port ${PORT}                 ║
║  Accès local:   http://localhost:${PORT}            ║
║  Accès réseau:  http://${localIP}:${PORT}        ║
╚═══════════════════════════════════════════════════╝
  `);
});
