/**
 * Page d'accueil - Connexion avec pseudo
 */

import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SocketService } from '../../services/socket.service';
import { ThemeService } from '../../services/theme.service';

@Component({
    selector: 'app-home',
    standalone: true,
    template: `
    <div class="home-container">
      <!-- Header avec toggle thème -->
      <header class="home-header">
        <button class="btn btn-icon btn-secondary" (click)="themeService.toggle()" title="Changer de thème">
          @if (themeService.theme() === 'dark') {
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          }
        </button>
      </header>

      <!-- Contenu principal -->
      <main class="home-main">
        <div class="home-content animate-fadeIn">
          <!-- Logo et titre -->
          <div class="home-logo">
            <div class="logo-icon">🎮</div>
            <h1 class="logo-title">Node Play</h1>
            <p class="logo-subtitle">Hub de jeux multijoueur</p>
          </div>

          <!-- Formulaire de connexion -->
          <form class="login-form card" (submit)="onSubmit($event)">
            <h2 class="form-title">Bienvenue !</h2>
            <p class="form-description">Entrez votre pseudo pour rejoindre le hub</p>

            <div class="form-group">
              <input 
                type="text" 
                class="input"
                placeholder="Votre pseudo..."
                [value]="username()"
                (input)="onUsernameChange($event)"
                maxlength="20"
                autofocus
              />
              @if (socketService.error()) {
                <p class="error-message">{{ socketService.error() }}</p>
              }
            </div>

            <button 
              type="submit" 
              class="btn btn-primary w-full"
              [disabled]="isLoading() || username().trim().length < 2"
            >
              @if (isLoading()) {
                <span class="spinner"></span>
                Connexion...
              } @else {
                Rejoindre le hub
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              }
            </button>
          </form>

          <!-- Info connexion -->
          <p class="connection-info">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            Partagez l'adresse IP de l'hôte pour jouer ensemble !
          </p>
        </div>
      </main>

      <!-- Décoration de fond -->
      <div class="bg-decoration">
        <div class="bg-blob blob-1"></div>
        <div class="bg-blob blob-2"></div>
        <div class="bg-blob blob-3"></div>
      </div>
    </div>
  `,
    styles: [`
    .home-container {
      min-height: 100vh;
      position: relative;
      overflow: hidden;
    }

    .home-header {
      position: absolute;
      top: 1.5rem;
      right: 1.5rem;
      z-index: 10;
    }

    .home-main {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }

    .home-content {
      width: 100%;
      max-width: 420px;
      z-index: 1;
    }

    .home-logo {
      text-align: center;
      margin-bottom: 2rem;
    }

    .logo-icon {
      font-size: 4rem;
      margin-bottom: 0.5rem;
      filter: drop-shadow(0 4px 20px rgba(99, 102, 241, 0.3));
    }

    .logo-title {
      font-size: 2.5rem;
      background: var(--gradient-primary);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 0.25rem;
    }

    .logo-subtitle {
      color: var(--text-muted);
      font-size: 1rem;
    }

    .login-form {
      padding: 2rem;
    }

    .form-title {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
      text-align: center;
    }

    .form-description {
      text-align: center;
      margin-bottom: 1.5rem;
      color: var(--text-secondary);
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .error-message {
      color: var(--danger);
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .connection-info {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 1.5rem;
      font-size: 0.875rem;
      color: var(--text-muted);
    }

    /* Décoration de fond */
    .bg-decoration {
      position: fixed;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }

    .bg-blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.4;
    }

    .blob-1 {
      width: 500px;
      height: 500px;
      background: var(--primary);
      top: -200px;
      right: -100px;
    }

    .blob-2 {
      width: 400px;
      height: 400px;
      background: var(--secondary);
      bottom: -100px;
      left: -100px;
    }

    .blob-3 {
      width: 300px;
      height: 300px;
      background: var(--accent);
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      opacity: 0.2;
    }
  `]
})
export class HomeComponent {
    socketService = inject(SocketService);
    themeService = inject(ThemeService);
    private router = inject(Router);

    username = signal('');
    isLoading = signal(false);

    constructor() {
        // Connecter au serveur au chargement
        const serverUrl = window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : `http://${window.location.hostname}:3000`;

        this.socketService.connect(serverUrl);
    }

    onUsernameChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.username.set(input.value);
        this.socketService.clearError();
    }

    onSubmit(event: Event): void {
        event.preventDefault();

        if (this.username().trim().length < 2) return;

        this.isLoading.set(true);
        this.socketService.join(this.username().trim());

        // Observer la connexion réussie pour rediriger
        const checkConnection = setInterval(() => {
            if (this.socketService.currentPlayer()) {
                clearInterval(checkConnection);
                this.router.navigate(['/hub']);
            }
            if (this.socketService.error()) {
                clearInterval(checkConnection);
                this.isLoading.set(false);
            }
        }, 100);

        // Timeout après 5 secondes
        setTimeout(() => {
            clearInterval(checkConnection);
            this.isLoading.set(false);
        }, 5000);
    }
}
