import {AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild} from '@angular/core';
import {UtilService} from 'src/app/services/util.service';

@Component({
  selector: 'app-leadership-impact',
  templateUrl: './leadership-impact.component.html',
  styleUrls: ['./leadership-impact.component.scss'],
})
export class LeadershipImpactComponent implements AfterViewInit, OnDestroy {
  @ViewChild('metricsScroll', {static: false}) metricsScroll?: ElementRef;
  @Input() eyebrow: string = 'LEADERSHIP IMPACT';
  @Input() bigStat: string|number = '';
  @Input() statLabel: string = '';
  @Input() description: string = '';
  @Input()
  backgroundGradient: string =
      'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)';
  @Input()
  metrics: Array<{
    type: 'ao' | 'region' | 'overall' | 'diversity' | 'attendance' |
        'bd_overall' | 'bd_region' | 'q_overall' | 'participation' |
        'consistency';
    label: string;
    rank?: number;
    total?: number;
    percentile?: number;
    value?: number; priority: number;
  }> = [];

  private resizeObserver?: ResizeObserver;

  constructor(private readonly utilService: UtilService) {}

  ngAfterViewInit() {
    if (this.metricsScroll) {
      this.setupScrollSnap();
      this.setupPadding();
    }
  }

  private setupPadding() {
    if (!this.metricsScroll) return;

    const updatePadding = () => {
      const container = this.metricsScroll?.nativeElement;
      if (!container) return;

      const cards = container.querySelectorAll('.metric-card');
      if (cards.length === 0) return;

      const cardWidth = (cards[0] as HTMLElement).offsetWidth;
      // Get the actual visible width of the scroll container
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;

      // Calculate padding to center cards: (container width - card width) / 2
      // This ensures cards can be centered with adjacent cards visible on sides
      const padding = Math.max(0, (containerWidth - cardWidth) / 2);

      container.style.paddingLeft = `${padding}px`;
      container.style.paddingRight = `${padding}px`;
    };

    // Initial setup
    setTimeout(updatePadding, 0);

    // Update on resize
    let resizeTimeout: any;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updatePadding, 100);
    });

    if (this.metricsScroll?.nativeElement) {
      this.resizeObserver = resizeObserver;
      resizeObserver.observe(this.metricsScroll.nativeElement);
    }
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  getMetricIcon(type: string): string {
    const icons: {[key: string]: string} = {
      'ao': '📍',             // Location pin for AO
      'region': '🗺️',   // Map for region
      'overall': '🏆',        // Trophy for overall
      'diversity': '🌟',      // Star for diversity
      'attendance': '👥',     // People for attendance
      'bd_overall': '💪',     // Flexed bicep for BDs overall
      'bd_region': '🏃',      // Runner for regional BDs
      'q_overall': '👑',      // Crown for Q overall
      'participation': '✨',  // Sparkles for participation/encouragement
      'consistency': '📅',    // Calendar for consistency
    };
    return icons[type] || '⭐';
  }

  private setupScrollSnap() {
    if (!this.metricsScroll) return;

    const container = this.metricsScroll.nativeElement;
    let scrollTimeout: any;
    let isUserScrolling = false;

    // CSS scroll-snap handles most of the snapping, but we add refinement
    // on scroll end to ensure perfect centering
    container.addEventListener('scroll', () => {
      if (!isUserScrolling) {
        isUserScrolling = true;
      }

      clearTimeout(scrollTimeout);

      scrollTimeout = setTimeout(() => {
        isUserScrolling = false;
        const cards = container.querySelectorAll('.metric-card');
        if (cards.length === 0) return;

        const containerRect = container.getBoundingClientRect();
        const containerCenter = containerRect.left + containerRect.width / 2;

        // Find which card is closest to center
        let closestCard: HTMLElement|null = null;
        let closestDistance = Infinity;

        cards.forEach((card: Element) => {
          const cardElement = card as HTMLElement;
          const cardRect = cardElement.getBoundingClientRect();
          const cardCenter = cardRect.left + cardRect.width / 2;
          const distance = Math.abs(cardCenter - containerCenter);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestCard = cardElement;
          }
        });

        // If we found a card and it's not well-centered, snap to it
        if (closestCard !== null && closestDistance > 5) {
          const cardElement = closestCard as HTMLElement;
          const cardLeft = cardElement.offsetLeft;
          const cardWidth = cardElement.offsetWidth;
          const containerWidth = containerRect.width;

          // Calculate scroll position to center this card
          // Account for the padding-left
          const paddingLeft =
              parseFloat(getComputedStyle(container).paddingLeft) || 0;
          const cardCenter = cardLeft + cardWidth / 2;
          const scrollTo = cardCenter - containerWidth / 2;

          container.scrollTo({left: Math.max(0, scrollTo), behavior: 'smooth'});
        }
      }, 150);
    }, {passive: true});
  }
}
