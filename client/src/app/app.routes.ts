/**
 * Configuration des routes de l'application
 */

import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
    },
    {
        path: 'hub',
        loadComponent: () => import('./pages/hub/hub.component').then(m => m.HubComponent)
    },
    {
        path: 'lobby',
        loadComponent: () => import('./pages/lobby/lobby.component').then(m => m.LobbyComponent)
    },
    {
        path: 'skyjo',
        loadComponent: () => import('./pages/skyjo/skyjo.component').then(m => m.SkyjoComponent)
    },
    {
        path: '**',
        redirectTo: ''
    }
];
