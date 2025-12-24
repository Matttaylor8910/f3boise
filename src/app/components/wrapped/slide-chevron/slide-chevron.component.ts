import {Component, ElementRef, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';

@Component({
  selector: 'app-slide-chevron',
  templateUrl: './slide-chevron.component.html',
  styleUrls: ['./slide-chevron.component.scss'],
})
export class SlideChevronComponent implements OnInit, OnDestroy {
  @Input() slideElement?: HTMLElement;
  @ViewChild('chevron', {static: false}) chevronRef?: ElementRef;

  showChevron = false;
  private visibilityTimer?: number;
  private intersectionObserver?: IntersectionObserver;
  private isVisible = false;
  private timeVisibleStart = 0;

  constructor(private elementRef: ElementRef) {}

  ngOnInit() {
    if (!this.slideElement) {
      // If no slide element provided, use parent
      this.slideElement = this.getParentSlideElement();
    }

    if (this.slideElement) {
      this.setupIntersectionObserver();
    }
  }

  ngOnDestroy() {
    this.cleanup();
  }

  private getParentSlideElement(): HTMLElement | undefined {
    // Try to find parent element using ElementRef
    const hostElement = this.elementRef?.nativeElement;
    if (!hostElement) {
      return undefined;
    }

    let element: HTMLElement | null = hostElement.parentElement;

    // Walk up the DOM tree to find a slide element
    while (element && element !== document.body) {
      if (element.classList.contains('stat-slide') ||
          element.classList.contains('narrative-slide') ||
          element.classList.contains('workout-type-slide') ||
          element.classList.contains('top-aos-slide') ||
          element.classList.contains('home-base-slide') ||
          element.classList.contains('combined-slide') ||
          element.classList.contains('intro-slide-in-slides') ||
          element.classList.contains('pax-slide')) {
        return element;
      }
      element = element.parentElement;
    }
    return undefined;
  }

  private setupIntersectionObserver() {
    if (!this.slideElement) return;

    this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
              // Slide is visible
              if (!this.isVisible) {
                this.isVisible = true;
                this.timeVisibleStart = Date.now();
                this.startTimer();
              }
            } else {
              // Slide is not visible
              if (this.isVisible) {
                this.isVisible = false;
                this.showChevron = false;
                this.clearTimer();
              }
            }
          });
        },
        {
          threshold: 0.5,  // Consider visible when 50% is in viewport
          rootMargin: '0px',
        });

    this.intersectionObserver.observe(this.slideElement);
  }

  private startTimer() {
    this.clearTimer();
    this.visibilityTimer = window.setTimeout(() => {
      if (this.isVisible) {
        const timeVisible = Date.now() - this.timeVisibleStart;
        if (timeVisible >= 5000) {  // 5 seconds
          this.showChevron = true;
        }
      }
    }, 5000);
  }

  private clearTimer() {
    if (this.visibilityTimer) {
      clearTimeout(this.visibilityTimer);
      this.visibilityTimer = undefined;
    }
  }

  private cleanup() {
    this.clearTimer();
    if (this.intersectionObserver && this.slideElement) {
      this.intersectionObserver.unobserve(this.slideElement);
      this.intersectionObserver.disconnect();
    }
  }
}

