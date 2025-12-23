import {AfterViewInit, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, NavigationExtras, Router} from '@angular/router';
import {ToastController} from '@ionic/angular';
import {WrappedData} from 'src/app/interfaces/wrapped-data.interface';
import {AuthService} from 'src/app/services/auth.service';
import {PaxService} from 'src/app/services/pax.service';
import {UtilService} from 'src/app/services/util.service';
import {WrappedService} from 'src/app/services/wrapped.service';

type FirebaseUser = any;

@Component({
  selector: 'app-beatdown-breakdown',
  templateUrl: './beatdown-breakdown.page.html',
  styleUrls: ['./beatdown-breakdown.page.scss'],
})
export class BeatdownBreakdownPage implements OnInit, AfterViewInit {
  @ViewChild('slidesContainer', {static: false}) slidesContainer!: ElementRef;
  @ViewChild('emailInput', {static: false}) emailInput!: any;

  year: string;
  userId: string|null = null;
  user: FirebaseUser|null = null;
  paxName: string|undefined;
  wrappedData: WrappedData|null = null;
  currentSlideIndex = 0;
  totalSlides = 7;  // Intro slide + 6 content slides
  showEmailInput = false;
  email = '';
  isSendingEmail = false;

  constructor(
      public readonly utilService: UtilService,
      private readonly route: ActivatedRoute,
      private readonly authService: AuthService,
      private readonly paxService: PaxService,
      private readonly router: Router,
      private readonly wrappedService: WrappedService,
      private readonly toastController: ToastController,
  ) {
    this.year = this.route.snapshot.params['year'];
    // Validate year is a 4-digit number
    if (!/^\d{4}$/.test(this.year)) {
      // Invalid year format, redirect to home
      this.router.navigateByUrl('/ao/all');
    }
  }

  ngOnInit() {
    // Check for test pax query parameter
    const paxParam = this.route.snapshot.queryParams['pax'];
    if (paxParam) {
      // Bypass auth and load data for specified pax
      this.loadWrappedDataForPax(paxParam);
      return;
    }

    // Handle email link sign-in if present
    this.handleEmailLinkSignIn();

    // Get user ID from auth service
    this.authService.authState$.subscribe(user => {
      this.user = user;
      if (user?.uid) {
        this.userId = user.email || user.uid;  // Prefer email, fallback to UID
        this.showEmailInput =
            false;  // Hide email input if user becomes authenticated
        // Load data in background
        this.loadWrappedData();
      } else {
        // User not logged in, show intro slide only
        this.showEmailInput = false;
      }
    });
  }

  ngAfterViewInit() {
    if (this.slidesContainer) {
      this.setupScrollListener();
    }
  }

  ionViewDidEnter() {
    // Get the current user's pax name
    if (this.user?.email) {
      this.paxService.getPaxByEmail(this.user.email).then(pax => {
        this.paxName = pax?.name;
      });
    }
  }

  private async loadWrappedDataForPax(paxName: string) {
    try {
      // Get pax by name
      const pax = await this.paxService.getPax(paxName);
      if (!pax) {
        console.error(`No PAX found with name: ${paxName}`);
        return;
      }

      // Use email if available, otherwise use pax name as identifier
      const identifier = pax.email || pax.name;
      this.paxName = pax.name;
      this.userId = identifier;

      const yearNum = parseInt(this.year, 10);
      this.wrappedService.getWrappedData(identifier, yearNum).subscribe({
        next: (data) => {
          this.wrappedData = data;
          // Auto-scroll past intro slide
          setTimeout(() => {
            this.currentSlideIndex = 1;
            this.scrollToSlide(1);
          }, 500);
        },
        error: (error) => {
          console.error('Error loading wrapped data:', error);
        }
      });
    } catch (error) {
      console.error('Error loading pax data:', error);
    }
  }

  private loadWrappedData() {
    if (!this.userId || !this.year) return;

    const yearNum = parseInt(this.year, 10);
    this.wrappedService.getWrappedData(this.userId, yearNum).subscribe({
      next: (data) => {
        this.wrappedData = data;
      },
      error: (error) => {
        console.error('Error loading wrapped data:', error);
        // Silently fail - slides will just be blank
      }
    });
  }

  onLetsRoll() {
    if (this.user?.uid) {
      // User is authenticated, scroll to the first content slide
      this.currentSlideIndex = 1;
      this.scrollToSlide(1);
    } else {
      // User is not authenticated, show email input
      this.showEmailInput = true;
      // Focus on email input after a short delay to allow animation
      setTimeout(() => {
        if (this.emailInput) {
          const inputElement = this.emailInput.getInputElement();
          if (inputElement) {
            inputElement.then((el: HTMLInputElement) => {
              el.focus();
            });
          }
        }
      }, 400);
    }
  }

  async sendLoginLink() {
    if (!this.email || !this.isValidEmail(this.email)) {
      await this.showToast('Please enter a valid email address', 'danger');
      return;
    }

    this.isSendingEmail = true;

    try {
      // Check if email is registered as a PAX
      const pax = await this.paxService.getPaxByEmail(this.email);
      if (!pax) {
        await this.showToast(
            'This email is not registered. Please contact an admin to register your email.',
            'danger',
        );
        this.isSendingEmail = false;
        return;
      }

      const actionCodeSettings = this.authService.createActionCodeSettings(
          window.location.origin + `/${this.year}`,
      );

      await this.authService.sendSignInLinkToEmail(
          this.email, actionCodeSettings);
      await this.showToast(
          'Check your email for a sign-in link!',
          'success',
      );
      this.showEmailInput = false;
    } catch (error: any) {
      await this.showToast(
          error.message || 'Failed to send login link. Please try again.',
          'danger',
      );
    } finally {
      this.isSendingEmail = false;
    }
  }

  private async handleEmailLinkSignIn() {
    if (this.authService.isSignInWithEmailLink()) {
      try {
        await this.authService.signInWithEmailLink();
        const toast = await this.toastController.create({
          message: 'Successfully signed in!',
          duration: 3000,
          color: 'success',
          position: 'top',
        });
        await toast.present();
        // Clean up the URL by removing the query parameters
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
      } catch (error: any) {
        const toast = await this.toastController.create({
          message: error.message || 'Failed to sign in. Please try again.',
          duration: 5000,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      }
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top',
    });
    await toast.present();
  }

  goToHome() {
    const navigationExtras: NavigationExtras = {
      replaceUrl: true,  // Replace current history state instead of pushing
    };
    this.router.navigateByUrl('/ao/all', navigationExtras);
  }

  getTotalPostsDescription(): string {
    if (!this.wrappedData) return '';
    if (this.wrappedData.isFirstYear) {
      return `WE'RE GLAD YOU STARTED MAKING FITNESS, FELLOWSHIP, AND FAITH A PART OF YOUR MORNING IN ${
          this.wrappedData.year}`;
    }
    return `THAT'S ${
        this.wrappedData
            .totalPosts} MORNINGS YOU CONQUERED THE GLOOM WHEN YOUR BED WANTED YOU TO STAY.`;
  }

  formatMinutes(minutes: number): string {
    if (!minutes) return '0';
    // Format with comma separators for thousands
    return minutes.toLocaleString();
  }

  getMinutesDescription(): string {
    if (!this.wrappedData) return '';
    const hours = Math.floor(this.wrappedData.totalMinutesInGloom / 60);
    const minutes = this.wrappedData.totalMinutesInGloom % 60;
    if (hours > 0) {
      if (minutes === 0) {
        return `THAT'S ${hours} HOURS OF PURE GLOOM.`;
      }
      return `THAT'S ${hours} HOURS AND ${minutes} MINUTES OF PURE GLOOM.`;
    }
    return `THAT'S ${minutes} MINUTES OF PURE GLOOM.`;
  }

  getTopAODescription(): string {
    if (!this.wrappedData) return '';
    return `YOU CLAIMED THIS AO AS YOUR OWN. THAT'S ${
        this.wrappedData.topAO.percentage}% OF ALL YOUR POSTS AT ONE LOCATION.`;
  }

  getBurpeesDescription(): string {
    if (!this.wrappedData) return '';
    return `BASED ON AVERAGE BEATDOWN DATA, YOU DID ROUGHLY ${
        this.wrappedData
            .estimatedBurpees} BURPEES. YOUR CHEST AND THE GROUND BECAME VERY CLOSE FRIENDS.`;
  }

  getQStatsDescription(): string {
    if (!this.wrappedData) return '';
    return `YOU LED ${this.wrappedData.qStats.timesAsQ} BEATDOWNS AND PUSHED ${
        this.wrappedData.qStats.totalPaxLed} TOTAL PAX. YOUR AVERAGE Q HAD ${
        this.wrappedData.qStats.averagePaxPerQ} PAX SHOW UP.`;
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
            this.currentSlideIndex =
                Math.max(0, Math.min(newIndex, this.totalSlides - 1));
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
    }, {passive: true});

    container.addEventListener('touchmove', (e: TouchEvent) => {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
    }, {passive: true});

    container.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;

      const deltaY = startY - currentY;
      const threshold = 50;  // Minimum swipe distance

      if (Math.abs(deltaY) > threshold) {
        if (deltaY > 0) {
          // Swipe up - next slide
          this.nextSlide();
        } else {
          // Swipe down - previous slide
          this.previousSlide();
        }
      }
    }, {passive: true});
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
      container.scrollTo({top: index * slideHeight, behavior: 'smooth'});
    }
  }
}
