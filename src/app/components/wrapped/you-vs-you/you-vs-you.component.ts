import {AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild} from '@angular/core';

@Component({
  selector: 'app-you-vs-you',
  templateUrl: './you-vs-you.component.html',
  styleUrls: ['./you-vs-you.component.scss'],
})
export class YouVsYouComponent implements AfterViewInit, OnDestroy {
  @Input() currentYear: number = 0;
  @Input() previousYear: number = 0;
  @Input()
  totalPosts: {
    current: number; previous: number; change: number; changePercent: number
  }|null = null;
  @Input()
  totalMinutes: {
    current: number; previous: number; change: number; changePercent: number
  }|null = null;
  @Input()
  timesAsQ: {
    current: number; previous: number; change: number; changePercent: number
  }|null = null;
  @Input()
  totalPaxEncountered: {
    current: number; previous: number; change: number; changePercent: number
  }|null = null;
  @Input()
  uniqueAOs: {
    current: number; previous: number; change: number; changePercent: number
  }|null = null;
  @Input()
  backgroundGradient: string =
      'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)';
  @Input() paxName: string = '';
  @Input() paxPhotoUrl: string|null = null;
  @Input() videoSrc: string = '';
  @Input() isFirstYear: boolean = false;

  @ViewChild('videoElement', {static: false})
  videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('slideElement', {static: false})
  slideElement!: ElementRef<HTMLDivElement>;

  showVideo = true;
  showStats = false;
  private intersectionObserver?: IntersectionObserver;
  private videoTimeout?: number;
  private hasStarted = false;

  ngAfterViewInit() {
    this.setupIntersectionObserver();
  }

  ngOnDestroy() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    if (this.videoTimeout) {
      clearTimeout(this.videoTimeout);
    }
  }

  private setupIntersectionObserver() {
    if (!this.slideElement?.nativeElement) return;

    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5,
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.hasStarted) {
          this.startVideoSequence();
        }
      });
    }, options);

    this.intersectionObserver.observe(this.slideElement.nativeElement);
  }

  private startVideoSequence() {
    if (this.hasStarted) return;
    this.hasStarted = true;

    // Play video
    if (this.videoElement?.nativeElement) {
      const video = this.videoElement.nativeElement;
      video.currentTime = 0;
      video.muted = false;
      video.play().catch(() => {
        // Fallback to muted autoplay
        video.muted = true;
        video.play();
        video.muted = false;
      });
    }

    // After 6 seconds, fade out video and show stats
    this.videoTimeout = window.setTimeout(() => {
      this.showVideo = false;
      this.showStats = true;

      // Fade out video if still playing
      if (this.videoElement?.nativeElement) {
        const video = this.videoElement.nativeElement;
        const fadeDuration = 1000;
        const startTime = performance.now();
        const startOpacity = 1;

        const fade = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / fadeDuration, 1);
          const opacity = startOpacity * (1 - progress);

          video.style.opacity = opacity.toString();

          if (progress < 1) {
            requestAnimationFrame(fade);
          } else {
            video.pause();
          }
        };

        requestAnimationFrame(fade);
      }
    }, 4500);
  }

  enableSoundAndPlay(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.videoElement?.nativeElement) {
      const video = this.videoElement.nativeElement;
      video.muted = false;
      if (video.paused) {
        video.play();
      }
    }
  }

  Math = Math;  // Expose Math to template

  getChangeIcon(changePercent: number): string {
    return changePercent >= 0 ? '▲' : '▼';
  }

  getChangeColor(changePercent: number): string {
    return changePercent >= 0 ? '#4caf50' : '#f35959';
  }

  formatNumber(num: number): string {
    return num.toLocaleString();
  }

  formatMinutes(minutes: number): string {
    return minutes.toLocaleString();
  }

  hasComparisonData(): boolean {
    return !this.isFirstYear && this.totalPosts !== null &&
        this.totalMinutes !== null && this.timesAsQ !== null &&
        this.totalPaxEncountered !== null && this.uniqueAOs !== null;
  }

  getCurrentYearStats() {
    return {
      totalPosts: this.totalPosts?.current || 0,
      totalMinutes: this.totalMinutes?.current || 0,
      timesAsQ: this.timesAsQ?.current || 0,
      totalPaxEncountered: this.totalPaxEncountered?.current || 0,
      uniqueAOs: this.uniqueAOs?.current || 0,
    };
  }
}
