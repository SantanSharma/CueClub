import { Directive, ElementRef, HostListener, OnDestroy, computed, effect, inject, input } from '@angular/core';

type Placement = 'top' | 'bottom' | 'left' | 'right';

/**
 * Contextual help. Hover on pointer devices, tap-to-toggle on touch devices
 * (where hover does not exist). Auto-dismisses on touch after a short read.
 */
@Directive({
  selector: '[appTooltip]',
  host: { '[attr.aria-label]': 'ariaLabel()' },
})
export class TooltipDirective implements OnDestroy {
  appTooltip = input.required<string>();
  tooltipPlacement = input<Placement>('top');

  private host = inject(ElementRef<HTMLElement>);

  /**
   * Icon-only controls get their accessible name from the tooltip, but an
   * explicit aria-label on the element always wins — otherwise adding a tooltip
   * would silently rename the control for screen readers.
   */
  private readonly ownLabel: string | null = this.host.nativeElement.getAttribute('aria-label');
  ariaLabel = computed(() => this.ownLabel ?? this.appTooltip());
  private tip: HTMLElement | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  private get isTouch(): boolean {
    return window.matchMedia('(hover: none)').matches;
  }

  constructor() {
    // Keep an open tooltip in sync if its text changes.
    effect(() => {
      const text = this.appTooltip();
      if (this.tip) this.tip.textContent = text;
    });
  }

  @HostListener('mouseenter')
  onEnter(): void {
    if (!this.isTouch) this.show();
  }

  @HostListener('mouseleave')
  @HostListener('blur')
  onLeave(): void {
    if (!this.isTouch) this.hide();
  }

  @HostListener('focus')
  onFocus(): void {
    if (!this.isTouch) this.show();
  }

  @HostListener('click')
  onClick(): void {
    if (!this.isTouch) return;
    if (this.tip) {
      this.hide();
      return;
    }
    this.show();
    this.hideTimer = setTimeout(() => this.hide(), 2600);
  }

  @HostListener('document:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    this.hide();
  }

  ngOnDestroy(): void {
    this.hide();
  }

  private show(): void {
    const text = this.appTooltip();
    if (!text || this.tip) return;

    const tip = document.createElement('div');
    tip.textContent = text;
    tip.className =
      'pointer-events-none fixed z-[300] max-w-[240px] rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium leading-snug text-white shadow-[0_8px_24px_-6px_rgba(24,24,27,0.4)] transition-opacity duration-150';
    tip.style.opacity = '0';
    document.body.appendChild(tip);
    this.tip = tip;

    const anchor = this.host.nativeElement.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    const gap = 8;
    let top: number;
    let left: number;

    switch (this.tooltipPlacement()) {
      case 'bottom':
        top = anchor.bottom + gap;
        left = anchor.left + anchor.width / 2 - box.width / 2;
        break;
      case 'left':
        top = anchor.top + anchor.height / 2 - box.height / 2;
        left = anchor.left - box.width - gap;
        break;
      case 'right':
        top = anchor.top + anchor.height / 2 - box.height / 2;
        left = anchor.right + gap;
        break;
      default:
        top = anchor.top - box.height - gap;
        left = anchor.left + anchor.width / 2 - box.width / 2;
    }

    // Keep the tooltip inside the viewport.
    left = Math.min(Math.max(8, left), window.innerWidth - box.width - 8);
    if (top < 8) top = anchor.bottom + gap;

    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
    requestAnimationFrame(() => {
      if (this.tip) this.tip.style.opacity = '1';
    });
  }

  private hide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.tip?.remove();
    this.tip = null;
  }
}
