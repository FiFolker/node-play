/**
 * Page d'accueil - Connexion avec pseudo
 */

import { Component, inject, signal, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SocketService } from '../../services/socket.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit {
  socketService = inject(SocketService);
  themeService = inject(ThemeService);
  private router = inject(Router);

  username = signal('');
  isLoading = signal(false);

  // Mode développement (port 4200 = ng serve)
  isDev = signal(window.location.port === '4200');

  constructor() {
    // Connecter au serveur au chargement
    // Dev: port 3001, Prod: port 3000
    const serverPort = this.isDev() ? '3001' : '3000';
    const serverUrl = window.location.hostname === 'localhost'
      ? `http://localhost:${serverPort}`
      : `http://${window.location.hostname}:${serverPort}`;

    this.socketService.connect(serverUrl);
  }

  ngOnInit(): void {
    // Auto-connexion si session existante
    const session = this.socketService.restoreSession();
    if (session && !this.socketService.currentPlayer()) {
      this.username.set(session.username); // Pré-remplir
      console.log('[Home] Auto-login with:', session.username);
      this.socketService.join(session.username);
      this.isLoading.set(true);

      // Observer la connexion réussie pour rediriger
      const checkConnection = setInterval(() => {
        if (this.socketService.currentPlayer()) {
          clearInterval(checkConnection);
          this.router.navigate(['/hub']);
        }
        if (this.socketService.error()) {
          clearInterval(checkConnection);
          this.isLoading.set(false);
          // Si erreur (ex: pseudo pris), on clear la session pour laisser l'user choisir
          this.socketService.clearSession();
        }
      }, 100);
    }
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
