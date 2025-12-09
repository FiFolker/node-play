# 🎮 Node Play - Hub de Jeux Multijoueur

Hub de jeux multijoueur en réseau local avec Angular 21 et Node.js/Socket.io.

## 🚀 Démarrage rapide

### Prérequis
- Node.js 18+
- npm

### Installation

```bash
# 1. Installer les dépendances backend (à la racine)
npm install

# 2. Installer les dépendances frontend
cd client
npm install
cd ..
```

### Lancement

```bash
# Option 1: Développement (frontend + backend ensemble)
npm run dev

# Option 2: Séparément
# Terminal 1 - Backend
npm run server:dev

# Terminal 2 - Frontend
npm run client:dev
```

### Accès
- **Local**: http://localhost:4200
- **Réseau**: http://[VOTRE_IP]:4200

Pour trouver votre IP: `ipconfig` (Windows) ou `ifconfig` (Mac/Linux)

## 🎲 Jeux disponibles

### Skyjo
Jeu de cartes stratégique pour 2-8 joueurs.

**Règles:**
- Chaque joueur a une grille de 12 cartes (3×4)
- Objectif: avoir le moins de points possible
- Les cartes vont de -2 à +12
- 3 cartes identiques en colonne = disparition
- La partie se termine quand un joueur atteint 100 points

## 🏗️ Structure du projet

```
node-play/
├── server/              # Backend Node.js
│   ├── index.ts         # Point d'entrée Express + Socket.io
│   ├── game-manager.ts  # Gestion des lobbies
│   └── games/
│       └── skyjo.ts     # Logique Skyjo
├── client/              # Frontend Angular 21
│   └── src/app/
│       ├── pages/       # Composants de pages
│       ├── services/    # Services (Socket, Theme)
│       └── types.ts     # Types TypeScript
└── shared/              # Types partagés (référence)
```

## ⚙️ Configuration

| Variable | Valeur par défaut | Description |
|----------|-------------------|-------------|
| Port serveur | 3000 | Port WebSocket |
| Port client | 4200 | Port Angular dev |

## 📝 Fonctionnalités

- ✅ Connexion par pseudo
- ✅ Création de parties publiques/privées
- ✅ Code secret pour parties privées
- ✅ Lobby avec liste des joueurs
- ✅ Thème clair/sombre
- ✅ Jeu Skyjo complet
- ✅ Scores et manches
