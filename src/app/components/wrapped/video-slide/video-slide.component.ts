import {AfterViewInit, Component, ElementRef, Input, OnDestroy, Output, ViewChild, EventEmitter} from '@angular/core';

@Component({
  selector: 'app-video-slide',
  templateUrl: './video-slide.component.html',
  styleUrls: ['./video-slide.component.scss'],
})
export class VideoSlideComponent implements AfterViewInit, OnDestroy {
  @Input() videoSrc: string = '';
  @Input() backgroundGradient: string = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)';
  @Output() videoEnded = new EventEmitter<void>();
  @ViewChild('videoElement', {static: false}) videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('slideElement', {static: false}) slideElement!: ElementRef<HTMLDivElement>;

  private intersectionObserver?: IntersectionObserver;
  private hasPlayed = false;

  ngAfterViewInit() {
    // Preload the video when component initializes
    if (this.videoElement?.nativeElement) {
      const video = this.videoElement.nativeElement;
      video.preload = 'auto';
      video.load();

      // Listen for video end event
      video.addEventListener('ended', () => {
        this.videoEnded.emit();
      });

      // Set up Intersection Observer to detect when slide is visible
      this.setupIntersectionObserver();
    }
  }

  ngOnDestroy() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }

  private setupIntersectionObserver() {
    if (!this.slideElement?.nativeElement) return;

    const options = {
      root: null, // Use viewport as root
      rootMargin: '0px',
      threshold: 0.7, // Trigger when 70% of slide is visible (more reliable)
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.hasPlayed) {
          // Slide is visible, play the video
          this.playVideo();
        } else if (!entry.isIntersecting) {
          // Slide is not visible, pause and reset
          if (this.videoElement?.nativeElement) {
            const video = this.videoElement.nativeElement;
            video.pause();
            // Only reset if video hasn't ended (don't reset after completion)
            if (video.currentTime < video.duration - 0.5) {
              video.currentTime = 0;
              this.hasPlayed = false;
            }
          }
        }
      });
    }, options);

    this.intersectionObserver.observe(this.slideElement.nativeElement);
  }

  private playVideo() {
    if (this.videoElement?.nativeElement && !this.hasPlayed) {
      const video = this.videoElement.nativeElement;
      // Ensure video is at the start
      video.currentTime = 0;
      video.play().then(() => {
        this.hasPlayed = true;
      }).catch(err => {
        console.warn('Video autoplay prevented:', err);
        // If autoplay fails, user may need to interact first
        // The video will still be ready to play when they scroll to it
      });
    }
  }
}

