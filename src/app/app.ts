import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './features/sidebar/sidebar';
import { ThemeService } from './core/theme';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent],
  template: `
    <div class="shell">
      <app-sidebar />
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
    @media (max-width: 860px) {
      .shell {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class App {
  // instantiate so the theme effect runs from first paint
  private readonly theme = inject(ThemeService);
}
