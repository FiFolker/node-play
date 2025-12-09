/**
 * Service pour gérer le thème (clair/sombre)
 * Persiste le choix dans localStorage
 */

import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    private readonly STORAGE_KEY = 'node-play-theme';

    // Signal pour le thème actuel
    private _theme = signal<Theme>(this.getInitialTheme());
    readonly theme = this._theme.asReadonly();

    constructor() {
        // Effect pour appliquer le thème au DOM
        effect(() => {
            const theme = this._theme();
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem(this.STORAGE_KEY, theme);
        });
    }

    /**
     * Récupère le thème initial (localStorage ou préférence système)
     */
    private getInitialTheme(): Theme {
        const stored = localStorage.getItem(this.STORAGE_KEY) as Theme | null;
        if (stored) return stored;

        // Détecter la préférence système
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    /**
     * Bascule entre thème clair et sombre
     */
    toggle(): void {
        this._theme.update(current => current === 'light' ? 'dark' : 'light');
    }

    /**
     * Définit un thème spécifique
     */
    setTheme(theme: Theme): void {
        this._theme.set(theme);
    }
}
