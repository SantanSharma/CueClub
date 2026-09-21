import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SecurityService } from '../../../core/services/security.service';
import { IconComponent } from '../icon/icon';
import { ModalComponent } from '../modal/modal';

/**
 * The single passkey dialog for the whole app. Rendered once by the shell and
 * driven by SecurityService, so screens call `guard()` instead of building
 * their own checks.
 */
@Component({
  selector: 'app-passkey-prompt',
  imports: [FormsModule, ModalComponent, IconComponent],
  template: `
    @if (security.prompt(); as prompt) {
      <app-modal [title]="prompt.title" (close)="cancel()">
        <p class="text-[13px] leading-relaxed text-ink-soft">{{ prompt.message }}</p>
        <div>
          <label class="field-label">Admin passkey</label>
          <input
            #input
            class="input"
            [class.input-error]="error()"
            type="password"
            autocomplete="current-password"
            placeholder="Enter passkey"
            [(ngModel)]="passkey"
            (keyup.enter)="submit()"
            autofocus
          />
          @if (error()) {
            <p class="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-danger">
              <app-icon name="alert" [size]="13" /> That passkey is not correct.
            </p>
          }
        </div>
        <div modal-footer>
          <button type="button" class="btn btn-ghost" (click)="cancel()">Cancel</button>
          <button type="button" class="btn btn-primary" [disabled]="!passkey || checking()" (click)="submit()">
            {{ prompt.confirmLabel }}
          </button>
        </div>
      </app-modal>
    }
  `,
  host: { class: 'contents' },
})
export class PasskeyPromptComponent {
  security = inject(SecurityService);

  passkey = '';
  error = signal(false);
  checking = signal(false);

  async submit(): Promise<void> {
    const prompt = this.security.prompt();
    if (!prompt || !this.passkey) return;
    this.checking.set(true);
    const ok = await this.security.verify(this.passkey);
    this.checking.set(false);
    if (!ok) {
      this.error.set(true);
      return;
    }
    this.reset();
    prompt.resolve(true);
  }

  cancel(): void {
    const prompt = this.security.prompt();
    this.reset();
    prompt?.resolve(false);
  }

  private reset(): void {
    this.passkey = '';
    this.error.set(false);
    this.checking.set(false);
  }
}
