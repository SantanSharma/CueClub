import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { DataStoreService } from '../../core/services/data-store.service';
import { OrderFlowService } from '../../core/services/order-flow.service';
import { OrderDrawerComponent } from '../../features/operations/order-drawer';
import { OrderDetailDrawerComponent } from '../../features/operations/order-detail-drawer';
import { IconComponent } from '../../shared/ui/icon/icon';
import { PasskeyPromptComponent } from '../../shared/ui/passkey-prompt/passkey-prompt';
import { ToastOutletComponent } from '../../shared/ui/toast/toast-outlet';
import { BottomNavComponent } from '../bottom-nav/bottom-nav';
import { SidebarNavComponent } from '../sidebar-nav/sidebar-nav';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    SidebarNavComponent,
    BottomNavComponent,
    ToastOutletComponent,
    OrderDrawerComponent,
    OrderDetailDrawerComponent,
    PasskeyPromptComponent,
    IconComponent,
  ],
  template: `
    <div class="min-h-dvh">
      <!-- Desktop rail -->
      <div class="fixed inset-y-0 left-0 z-[80] hidden lg:block">
        <app-sidebar-nav />
      </div>

      <div class="lg:pl-[248px]">
        <!-- Mobile / tablet app bar -->
        <header
          class="sticky top-0 z-[70] flex items-center gap-2.5 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur-lg lg:hidden"
        >
          <a routerLink="/operations" class="flex items-center gap-2.5">
            <span
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-darker text-white"
            >
              <app-icon name="cue" [size]="17" />
            </span>
            <span class="min-w-0">
              <span class="block text-[14px] leading-tight font-extrabold tracking-tight text-ink">CueClub</span>
              <span class="block truncate text-[11px] leading-tight text-muted">{{ store.config().shopName }}</span>
            </span>
          </a>
          <span class="ml-auto pill bg-success-soft text-success">
            <span class="h-1.5 w-1.5 rounded-full bg-success"></span>
            {{ store.availableTablesCount() }}/{{ store.tables().length }} free
          </span>
        </header>

        @if (store.isHandover()) {
          <a
            routerLink="/settings"
            class="flex items-center gap-2 border-b border-warn/30 bg-warn-soft px-4 py-2 text-[13px] font-medium text-ink sm:px-6 lg:px-8"
          >
            <app-icon name="users" [size]="15" />
            <span class="min-w-0 flex-1 truncate">
              Handover mode · <strong>{{ store.currentActor() }}</strong> is operating
            </span>
            <span class="flex shrink-0 items-center gap-1 font-semibold text-warn">
              Manage <app-icon name="chevron-right" [size]="13" />
            </span>
          </a>
        }

        <main class="mx-auto w-full max-w-[1400px] px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pb-10">
          <router-outlet />
        </main>
      </div>

      <div class="lg:hidden">
        <app-bottom-nav />
      </div>
    </div>

    @if (flow.state().open) {
      <app-order-drawer />
    }
    @if (flow.openBillId()) {
      <app-order-detail-drawer [billId]="flow.openBillId()!" />
    }
    <app-passkey-prompt />
    <app-toast-outlet />
  `,
  host: { class: 'block' },
})
export class ShellComponent {
  store = inject(DataStoreService);
  flow = inject(OrderFlowService);
}
