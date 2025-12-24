import {AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild} from '@angular/core';
import html2canvas from 'html2canvas';

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
  @ViewChild('downloadButton', {static: false})
  downloadButton!: ElementRef<HTMLButtonElement>;

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

  enableSoundAndPlay() {
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
        this.totalPaxEncountered !== null;
  }

  getCurrentYearStats() {
    return {
      totalPosts: this.totalPosts?.current || 0,
      totalMinutes: this.totalMinutes?.current || 0,
      timesAsQ: this.timesAsQ?.current || 0,
      totalPaxEncountered: this.totalPaxEncountered?.current || 0,
    };
  }

  async downloadScreenshot() {
    if (!this.slideElement?.nativeElement) return;

    try {
      // Hide the download button and chevron temporarily
      const downloadButtonEl = this.downloadButton?.nativeElement;
      const chevron = this.slideElement.nativeElement.querySelector(
                          'app-slide-chevron') as HTMLElement;
      const originalDownloadDisplay = downloadButtonEl?.style.display;
      const originalChevronDisplay = chevron?.style.display;

      if (downloadButtonEl) downloadButtonEl.style.display = 'none';
      if (chevron) chevron.style.display = 'none';

      // Wait for all images to load before capturing
      await this.waitForImages();

      // Capture the slide element
      const canvas = await html2canvas(this.slideElement.nativeElement, {
        backgroundColor: null,
        scale: 2,  // Higher quality
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,  // Wait up to 15 seconds for images
        removeContainer: false,
        onclone: (clonedDoc, element) => {
          // Ensure images are loaded in the cloned document
          const images = clonedDoc.querySelectorAll('img');
          images.forEach((img: HTMLImageElement) => {
            if (!img.complete) {
              // Force reload if not complete
              const src = img.src;
              img.src = '';
              img.src = src;
            }
          });
        },
      });

      // Restore the hidden elements
      if (downloadButtonEl)
        downloadButtonEl.style.display = originalDownloadDisplay || '';
      if (chevron) chevron.style.display = originalChevronDisplay || '';

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Failed to create image blob');
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `f3-${this.paxName}-${this.currentYear}-summary.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (error) {
      console.error('Error capturing screenshot:', error);
    }
  }

  private async waitForImages(): Promise<void> {
    const images = this.slideElement.nativeElement.querySelectorAll('img');
    const imagePromises: Promise<void>[] = [];

    images.forEach((img: HTMLImageElement) => {
      if (img.complete) {
        return;  // Image already loaded
      }

      const promise = new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          // Resolve anyway after timeout to not block screenshot
          console.warn('Image load timeout:', img.src);
          resolve();
        }, 10000);  // 10 second timeout per image

        img.onload = () => {
          clearTimeout(timeout);
          resolve();
        };

        img.onerror = () => {
          clearTimeout(timeout);
          // Resolve anyway to not block the screenshot
          console.warn('Image failed to load:', img.src);
          resolve();
        };

        // If image has a src, ensure it's loading
        if (img.src && !img.complete) {
          // Force reload if needed
          const src = img.src;
          img.src = '';
          img.src = src;
        } else {
          clearTimeout(timeout);
          resolve();
        }
      });

      imagePromises.push(promise);
    });

    // Wait for all images (all promises resolve, even on error/timeout)
    await Promise.all(imagePromises);
  }
}
