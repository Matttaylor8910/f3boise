import {AfterViewInit, Component, ElementRef, Input, OnDestroy, Output, ViewChild, EventEmitter} from '@angular/core';

@Component({
  selector: 'app-video-slide',
  templateUrl: './video-slide.component.html',
  styleUrls: ['./video-slide.component.scss'],
})
export class VideoSlideComponent implements AfterViewInit, OnDestroy {
  @Input() videoSrc: string = '';
  @Input() backgroundGradient: string = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)';
  @Input() showCountdown: boolean = true; // Show countdown timer (default true for regional videos)
  @Input() enableFadeOut: boolean = false; // Enable fade-out on video end (default false, only for final video)
  @Output() videoEnded = new EventEmitter<void>();
  @ViewChild('videoElement', {static: false}) videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('slideElement', {static: false}) slideElement!: ElementRef<HTMLDivElement>;

  private intersectionObserver?: IntersectionObserver;
  private hasPlayed = false;
  showPlayButton = false;
  private soundEnabled = false;
  remainingSeconds: number = 0;
  private timeUpdateInterval?: any;
  isFadingOut = false;

  ngAfterViewInit() {
    // Preload the video when component initializes
    if (this.videoElement?.nativeElement) {
      const video = this.videoElement.nativeElement;
      video.preload = 'auto';
      video.load();

      // Listen for video end event
      video.addEventListener('ended', () => {
        this.remainingSeconds = 0;
        this.clearTimeUpdate();
        // Only fade out if enabled (for final video)
        if (this.enableFadeOut) {
          this.fadeOut();
        } else {
          // For regional videos, just emit the event without fading
          this.videoEnded.emit();
        }
      });

      // Listen for loadedmetadata to get video duration
      video.addEventListener('loadedmetadata', () => {
        if (this.showCountdown) {
          this.updateRemainingTime();
          this.setupTimeUpdate();
        }
      });

      // Set up Intersection Observer to detect when slide is visible
      this.setupIntersectionObserver();
    }
  }

  ngOnDestroy() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    this.clearTimeUpdate();
  }

  private setupTimeUpdate() {
    this.clearTimeUpdate();
    if (!this.showCountdown) return;

    // Update every 100ms for smooth countdown
    this.timeUpdateInterval = setInterval(() => {
      this.updateRemainingTime();
    }, 100);
  }

  private clearTimeUpdate() {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = undefined;
    }
  }

  private updateRemainingTime() {
    if (this.videoElement?.nativeElement) {
      const video = this.videoElement.nativeElement;
      if (video.duration && !isNaN(video.duration)) {
        const remaining = Math.max(0, Math.ceil(video.duration - video.currentTime));
        this.remainingSeconds = remaining;
      }
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

      // Try to play with sound (unmuted)
      video.muted = false;
      video.play().then(() => {
        this.hasPlayed = true;
        this.showPlayButton = false;
        this.soundEnabled = true;
        if (this.showCountdown) {
          this.setupTimeUpdate();
        }
      }).catch(err => {
        console.warn('Video autoplay prevented:', err);
        // On mobile Safari, autoplay with sound is blocked
        // Show play button overlay so user can tap to play with sound
        this.showPlayButton = true;
        // Try muted autoplay as fallback
        video.muted = true;
        video.play().then(() => {
          this.hasPlayed = true;
          if (this.showCountdown) {
            this.setupTimeUpdate();
          }
          // Sound will be enabled on next user interaction
        }).catch(() => {
          // Even muted autoplay failed, show play button
          this.showPlayButton = true;
        });
      });
    }
  }

  /**
   * Enables sound and plays video (called on user interaction)
   * This is needed for mobile Safari which blocks autoplay with sound
   */
  enableSoundAndPlay() {
    if (this.videoElement?.nativeElement) {
      const video = this.videoElement.nativeElement;

      // Enable sound
      video.muted = false;
      this.soundEnabled = true;
      this.showPlayButton = false;

      // If video is paused, play it
      if (video.paused) {
        video.play().then(() => {
          this.hasPlayed = true;
          if (this.showCountdown) {
            this.setupTimeUpdate();
          }
        }).catch(err => {
          console.warn('Failed to play video:', err);
        });
      } else {
        // Video is already playing (muted), just unmute it
        // The sound will now be enabled
        this.hasPlayed = true;
        if (this.showCountdown && !this.timeUpdateInterval) {
          this.setupTimeUpdate();
        }
      }
    }
  }

  private fadeOut() {
    if (this.videoElement?.nativeElement && !this.isFadingOut) {
      this.isFadingOut = true;
      const video = this.videoElement.nativeElement;

      // Fade out over 1 second
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
          // Fade complete, emit event
          this.videoEnded.emit();
        }
      };

      requestAnimationFrame(fade);
    }
  }
}

