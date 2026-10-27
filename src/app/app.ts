import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './features/sidebar/sidebar';
import { ThemeService } from './core/theme';
import { LayoutService } from './core/layout';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent],
  template: `
    <div class="shell" [class.drawer-open]="layout.sidebarOpen()">
      <app-sidebar class="sidebar" />
      <button class="scrim" type="button" aria-label="Close conversations" (click)="layout.closeSidebar()"></button>
      <main class="main">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    .shell {
      display: grid;
      grid-template-columns: var(--sidebar-w) 1fr;
      height: 100dvh;
      background: var(--bg);
    }
    .main {
      position: relative;
      min-width: 0;
      height: 100dvh;
      overflow: hidden;
    }
    .scrim {
      display: none;
    }
    @media (max-width: 860px) {
      .shell {
        grid-template-columns: 1fr;
      }
      .sidebar {
        position: fixed;
        inset: 0 auto 0 0;
        width: min(var(--sidebar-w), 86vw);
        z-index: 20;
        transform: translateX(-100%);
        transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
        box-shadow: var(--shadow);
      }
      .scrim {
        display: block;
        position: fixed;
        inset: 0;
        z-index: 19;
        background: var(--scrim);
        opacity: 0;
        pointer-events: none;
        transition: opacity 220ms ease;
      }
      .drawer-open .sidebar {
        transform: none;
      }
      .drawer-open .scrim {
        opacity: 1;
        pointer-events: auto;
      }
    }
  `,
})
export class App {
  readonly layout = inject(LayoutService);
  // instantiate so the theme effect runs from first paint
  private readonly theme = inject(ThemeService);
}
