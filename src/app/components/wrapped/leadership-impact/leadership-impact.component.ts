import {AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild} from '@angular/core';
import {UtilService} from 'src/app/services/util.service';

@Component({
  selector: 'app-leadership-impact',
  templateUrl: './leadership-impact.component.html',
  styleUrls: ['./leadership-impact.component.scss'],
})
export class LeadershipImpactComponent implements AfterViewInit, OnDestroy {
  @Input() eyebrow: string = 'LEADERSHIP IMPACT';
  @Input() bigStat: string|number = '';
  @Input() statLabel: string = '';
  @Input() description: string = '';
  @Input()
  backgroundGradient: string =
      'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)';
  @Input() callouts: Array<{message: string; rank: number}> = [];
  @Input() simpleCallout: string = ''; // Simple callout for encouragement messages
  @Input() qCountMaps: {
    overall: Map<string, number>;
    regions: Map<string, Map<string, number>>;
    aos: Map<string, Map<string, number>>;
  } = {
    overall: new Map(),
    regions: new Map(),
    aos: new Map(),
  };
  @Input() animateCount: boolean = false; // Enable count-up animation for numbers

  @ViewChild('slideElement', {static: false}) slideElement!: ElementRef<HTMLDivElement>;

  private intersectionObserver?: IntersectionObserver;
  animatedValue: number = 0;
  countAnimationStarted = false;
  private animationFrameId?: number;

  constructor(public readonly utilService: UtilService) {}

  ngAfterViewInit() {
    if (this.animateCount) {
      this.setupIntersectionObserver();
    }
  }

  ngOnDestroy() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private setupIntersectionObserver() {
    if (!this.slideElement?.nativeElement) return;

    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5, // Trigger when 50% of slide is visible
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.countAnimationStarted) {
          this.startCountAnimation();
        }
      });
    }, options);

    this.intersectionObserver.observe(this.slideElement.nativeElement);
  }

  private startCountAnimation() {
    const targetValue = typeof this.bigStat === 'number' ? this.bigStat : parseInt(this.bigStat.toString(), 10);
    if (isNaN(targetValue)) {
      return; // Can't animate non-numeric values
    }

    this.countAnimationStarted = true;
    this.animateCountUp(targetValue);
  }

  private animateCountUp(targetValue: number) {
    const startTime = performance.now();
    const duration = 2000; // 2 seconds for count animation

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1); // Clamp between 0 and 1

      // Ease-out function for smoother animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      this.animatedValue = Math.floor(easeOut * targetValue);

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        // Ensure we end at exactly the target
        this.animatedValue = targetValue;
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Get the displayed stat value - either animated count or the original bigStat
   */
  getDisplayedStat(): string {
    if (this.animateCount && this.countAnimationStarted) {
      return this.animatedValue.toString();
    }
    return typeof this.bigStat === 'string' ? this.bigStat : this.bigStat.toString();
  }

  getCalloutClass(rank: number): string {
    if (rank === 1) return 'callout-badge callout-gold';
    if (rank === 2) return 'callout-badge callout-silver';
    if (rank === 3) return 'callout-badge callout-bronze';
    return 'callout-badge';
  }

}
