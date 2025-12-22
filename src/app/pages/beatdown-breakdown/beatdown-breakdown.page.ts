import {Component, OnInit, ViewChild, ElementRef, AfterViewInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {AuthService} from 'src/app/services/auth.service';
import {PaxService} from 'src/app/services/pax.service';
import {UtilService} from 'src/app/services/util.service';
import {WrappedService} from 'src/app/services/wrapped.service';
import {WrappedData} from 'src/app/interfaces/wrapped-data.interface';

type FirebaseUser = any;

@Component({
  selector: 'app-beatdown-breakdown',
  templateUrl: './beatdown-breakdown.page.html',
  styleUrls: ['./beatdown-breakdown.page.scss'],
})
export class BeatdownBreakdownPage implements OnInit, AfterViewInit {
  @ViewChild('slidesContainer', { static: false }) slidesContainer!: ElementRef;
  
  userId: string;
  user: FirebaseUser|null = null;
  paxName: string|undefined;
  wrappedData: WrappedData | null = null;
  isLoading = true;
  currentSlideIndex = 0;
  totalSlides = 9; // Updated: removed monthly chart and day breakdown, added combined breakdown

  constructor(
      public readonly utilService: UtilService,
      private readonly route: ActivatedRoute,
      private readonly authService: AuthService,
      private readonly paxService: PaxService,
      private readonly router: Router,
      private readonly wrappedService: WrappedService,
  ) {
    this.userId = this.route.snapshot.params['userId'];
  }

  ngOnInit() {
    this.loadWrappedData();
  }

  ngAfterViewInit() {
    if (this.slidesContainer) {
      this.setupScrollListener();
    }
  }

  ionViewDidEnter() {
    // Get the current user to verify they're viewing their own breakdown
    this.authService.authState$.subscribe(async user => {
      this.user = user;
      if (user?.email) {
        const pax = await this.paxService.getPaxByEmail(user.email);
        this.paxName = pax?.name;
      }
    });
  }

  private loadWrappedData() {
    this.isLoading = true;
    this.wrappedService.getWrappedData(this.userId).subscribe({
      next: (data) => {
        this.wrappedData = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading wrapped data:', error);
        this.isLoading = false;
      }
    });
  }

  goToHome() {
    this.router.navigateByUrl('/ao/all');
  }

  getTotalPostsDescription(): string {
    if (!this.wrappedData) return '';
    return `That's ${this.wrappedData.totalPosts} mornings you conquered the gloom when your bed wanted you to stay.`;
  }

  getWakeUpDescription(): string {
    if (!this.wrappedData) return '';
    return `Your earliest post was at ${this.wrappedData.earliestPost}. While most people were dreaming, you were already getting after it.`;
  }

  getTopAODescription(): string {
    if (!this.wrappedData) return '';
    return `You claimed this AO as your own. That's ${this.wrappedData.topAO.percentage}% of all your posts at one location.`;
  }

  getBurpeesDescription(): string {
    if (!this.wrappedData) return '';
    return `Based on average beatdown data, you did roughly ${this.wrappedData.estimatedBurpees} burpees. Your chest and the ground became very close friends.`;
  }

  getQStatsDescription(): string {
    if (!this.wrappedData) return '';
    return `You led ${this.wrappedData.qStats.timesAsQ} beatdowns and pushed ${this.wrappedData.qStats.totalPaxLed} total PAX. Your average Q had ${this.wrappedData.qStats.averagePaxPerQ} PAX show up.`;
  }

  getChallengeDescription(): string {
    if (!this.wrappedData) return '';
    return `Can you beat ${this.wrappedData.totalPosts}? We think you can hit ${this.wrappedData.challenge2025.targetPosts} in 2025. That's just ${this.wrappedData.challenge2025.postsPerWeek} posts a week. You've got this.`;
  }

  private setupScrollListener() {
    const container = this.slidesContainer.nativeElement;
    let isScrolling = false;
    
    container.addEventListener('scroll', () => {
      if (!isScrolling) {
        requestAnimationFrame(() => {
          const scrollTop = container.scrollTop;
          const slideHeight = window.innerHeight;
          const newIndex = Math.round(scrollTop / slideHeight);
          
          if (newIndex !== this.currentSlideIndex) {
            this.currentSlideIndex = Math.max(0, Math.min(newIndex, this.totalSlides - 1));
          }
          
          isScrolling = false;
        });
        isScrolling = true;
      }
    });

    // Add touch handling for smoother experience on mobile
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    container.addEventListener('touchstart', (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      isDragging = true;
    }, { passive: true });

    container.addEventListener('touchmove', (e: TouchEvent) => {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
    }, { passive: true });

    container.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;

      const deltaY = startY - currentY;
      const threshold = 50; // Minimum swipe distance

      if (Math.abs(deltaY) > threshold) {
        if (deltaY > 0) {
          // Swipe up - next slide
          this.nextSlide();
        } else {
          // Swipe down - previous slide
          this.previousSlide();
        }
      }
    }, { passive: true });
  }

  nextSlide() {
    if (this.currentSlideIndex < this.totalSlides - 1) {
      this.currentSlideIndex++;
      this.scrollToSlide(this.currentSlideIndex);
    }
  }

  previousSlide() {
    if (this.currentSlideIndex > 0) {
      this.currentSlideIndex--;
      this.scrollToSlide(this.currentSlideIndex);
    }
  }

  private scrollToSlide(index: number) {
    if (this.slidesContainer) {
      const container = this.slidesContainer.nativeElement;
      const slideHeight = window.innerHeight;
      container.scrollTo({
        top: index * slideHeight,
        behavior: 'smooth'
      });
    }
  }
}
