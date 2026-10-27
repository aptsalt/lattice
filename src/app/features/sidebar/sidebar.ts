import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ChatStore } from '../../core/chat-store';
import { ICONS } from '../../core/icons';
import { ThemeService } from '../../core/theme';
import { ALL_NODES, EDGES } from '../../core/graph-data';

@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class SidebarComponent {
  readonly store = inject(ChatStore);
  readonly theme = inject(ThemeService);
  readonly icons = ICONS;
  readonly graphSize = { nodes: ALL_NODES.length, edges: EDGES.length };

  readonly editingId = signal<string | null>(null);
  readonly confirmId = signal<string | null>(null);
  readonly draft = signal('');

  startRename(id: string, title: string, ev: Event): void {
    ev.stopPropagation();
    this.confirmId.set(null);
    this.editingId.set(id);
    this.draft.set(title);
  }

  commitRename(id: string): void {
    this.store.rename(id, this.draft());
    this.editingId.set(null);
  }

  cancelRename(): void {
    this.editingId.set(null);
  }

  askDelete(id: string, ev: Event): void {
    ev.stopPropagation();
    this.editingId.set(null);
    this.confirmId.set(id);
  }

  confirmDelete(id: string, ev: Event): void {
    ev.stopPropagation();
    this.store.remove(id);
    this.confirmId.set(null);
  }

  cancelDelete(ev: Event): void {
    ev.stopPropagation();
    this.confirmId.set(null);
  }

  onSearch(ev: Event): void {
    this.store.search.set((ev.target as HTMLInputElement).value);
  }
}
