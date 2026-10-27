import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/chat/chat').then((m) => m.ChatComponent), title: 'Lattice' },
  {
    path: 'architecture',
    loadComponent: () => import('./features/architecture/architecture').then((m) => m.ArchitectureComponent),
    title: 'Lattice — Architecture',
  },
  {
    path: 'guide',
    loadComponent: () => import('./features/guide/guide').then((m) => m.GuideComponent),
    title: 'Lattice — Guide',
  },
  { path: '**', redirectTo: '' },
];
