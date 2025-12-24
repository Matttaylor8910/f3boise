import {AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild} from '@angular/core';
import {UtilService} from 'src/app/services/util.service';

@Component({
  selector: 'app-stat-card',
  templateUrl: './stat-card.component.html',
  styleUrls: ['./stat-card.component.scss'],
})
export class StatCardComponent implements AfterViewInit, OnDestroy {
  @Input() eyebrow: string = '';
  @Input() bigStat: string|number = '';
  @Input() statLabel: string = '';
  @Input() description: string = '';
  @Input()
  backgroundGradient: string =
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  @Input() decorationIcon: string = '';
  @Input() photoUrl: string|null = null;
  @Input() paxName: string = '';
  @Input() hugeStat: boolean = false;
  @Input() isFirstYear: boolean = false;
  @Input() year: number = 0;
  @Input() leadIn: string = '';
  @Input() callout: string = '';
  @Input() animateClock: boolean = false; // Enable clock animation
  @Input() clockMinutes: number = 0; // Minutes to animate (for rotation calculation)

  @ViewChild('slideElement', {static: false}) slideElement!: ElementRef<HTMLDivElement>;
  @ViewChild('clockHand', {static: false}) clockHand!: ElementRef<HTMLDivElement>;
  @ViewChild('hourHand', {static: false}) hourHand!: ElementRef<HTMLDivElement>;

  private intersectionObserver?: IntersectionObserver;
  clockAnimationStarted = false;
  animatedMinutes: number = 0;
  private animationFrameId?: number;

  constructor(private readonly utilService: UtilService) {}

  ngAfterViewInit() {
    if (this.animateClock && this.clockMinutes > 0) {
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
        if (entry.isIntersecting && !this.clockAnimationStarted) {
          // Slide is visible, start the clock animation
          this.startClockAnimation();
        }
      });
    }, options);

    this.intersectionObserver.observe(this.slideElement.nativeElement);
  }

  private startClockAnimation() {
    if (this.clockHand?.nativeElement && this.hourHand?.nativeElement) {
      this.clockAnimationStarted = true;
      // Add animation class to trigger the CSS animation for both hands
      this.clockHand.nativeElement.classList.add('clock-animating');
      this.hourHand.nativeElement.classList.add('clock-animating');

      // Start counting up the minutes
      this.animateMinutesCount();
    }
  }

  private animateMinutesCount() {
    const startTime = performance.now();
    const duration = 5000; // 5 seconds to match clock animation
    const targetMinutes = this.clockMinutes;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1); // Clamp between 0 and 1

      // Ease-out function for smoother animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      this.animatedMinutes = Math.floor(easeOut * targetMinutes);

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        // Ensure we end at exactly the target
        this.animatedMinutes = targetMinutes;
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Get the displayed stat value - either animated minutes or the original bigStat
   */
  getDisplayedStat(): string {
    if (this.animateClock && this.clockMinutes > 0) {
      return this.formatMinutes(this.animatedMinutes);
    }
    return typeof this.bigStat === 'string' ? this.bigStat : this.bigStat.toString();
  }

  /**
   * Format minutes with commas (e.g., 1,234)
   */
  private formatMinutes(minutes: number): string {
    return minutes.toLocaleString();
  }

  get normalizedName(): string {
    return this.paxName ? this.utilService.normalizeName(this.paxName) : '';
  }

  /**
   * Calculate the total rotation in degrees for the minute hand animation
   * Each minute = 6 degrees (360 degrees / 60 minutes)
   * Returns as string for CSS
   */
  getClockRotation(): string {
    const rotation = this.clockMinutes * 6; // 6 degrees per minute
    return rotation.toString();
  }

  /**
   * Calculate the total rotation for the hour hand (1/12 the speed of minute hand)
   * Each hour = 30 degrees (360 degrees / 12 hours)
   * Since minutes / 60 = hours, and hour hand rotates 30 degrees per hour
   */
  getHourHandRotation(): string {
    const hours = this.clockMinutes / 60;
    const rotation = hours * 30; // 30 degrees per hour
    return rotation.toString();
  }
}