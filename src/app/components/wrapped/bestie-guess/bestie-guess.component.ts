import {AfterViewInit, Component, ElementRef, Input, Output, ViewChild, EventEmitter, OnDestroy} from '@angular/core';
import {WorkoutBuddy} from 'src/app/interfaces/wrapped-data.interface';
import {PaxService} from 'src/app/services/pax.service';
import {UtilService} from 'src/app/services/util.service';

@Component({
  selector: 'app-bestie-guess',
  templateUrl: './bestie-guess.component.html',
  styleUrls: ['./bestie-guess.component.scss'],
})
export class BestieGuessComponent implements AfterViewInit, OnDestroy {
  @Input() workoutBuddies: WorkoutBuddy[] = [];
  @Input() backgroundGradient: string = 'linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)';
  @Output() guessComplete = new EventEmitter<void>();
  @ViewChild('slideElement', {static: false}) slideElement!: ElementRef<HTMLDivElement>;

  options: Array<{buddy: WorkoutBuddy; photoUrl: string|null; isCorrect: boolean}> = [];
  selectedOption: number|null = null;
  showFeedback = false;
  isCorrect = false;
  correctAnswerName = '';
  private correctIndex = 0;
  isWaitingForDelay = false;
  private scrollLockPosition: number = 0;
  private scrollLockAnimationFrame?: number;

  // Dynamic background gradient
  currentBackgroundGradient = 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'; // Neutral gray
  private readonly neutralGradient = 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)';
  private readonly correctGradient = 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)'; // Greenish
  private readonly incorrectGradient = 'linear-gradient(135deg, #5d1f1f 0%, #7d2e2e 100%)'; // Reddish

  constructor(
      private readonly paxService: PaxService,
      public readonly utilService: UtilService,
  ) {}

  async ngAfterViewInit() {
    await this.setupOptions();
  }

  private async setupOptions() {
    if (!this.workoutBuddies || this.workoutBuddies.length === 0) {
      return;
    }

    // Get top 3 workout buddies
    const top3 = this.workoutBuddies.slice(0, 3);
    const correctBuddy = top3[0];
    this.correctAnswerName = this.utilService.normalizeName(correctBuddy.name);

    // Create options array with top 3 (first one is correct)
    const allOptions = top3.map((buddy, index) => ({
      buddy,
      isCorrect: index === 0,
    }));

    // Shuffle the options randomly
    const shuffled = allOptions.sort(() => Math.random() - 0.5);
    this.correctIndex = shuffled.findIndex(opt => opt.isCorrect);

    // Load photos for each option
    this.options = await Promise.all(
        shuffled.map(async (option) => {
          const pax = await this.paxService.getPax(option.buddy.name);
          return {
            ...option,
            photoUrl: pax?.img_url || null,
          };
        })
    );
  }

  selectOption(index: number, event?: Event) {
    if (this.selectedOption !== null) return; // Already selected

    // Prevent event bubbling and default behavior
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Lock scroll position immediately
    this.lockScrollPosition();

    this.selectedOption = index;
    this.isCorrect = this.options[index].isCorrect;
    this.showFeedback = true;
    this.isWaitingForDelay = true;

    // Change background gradient based on result
    if (this.isCorrect) {
      this.currentBackgroundGradient = this.correctGradient;
    } else {
      this.currentBackgroundGradient = this.incorrectGradient;
    }

    // Auto-advance after delay
    setTimeout(() => {
      this.unlockScrollPosition();
      this.isWaitingForDelay = false;
      this.guessComplete.emit();
    }, 2000); // 2 second delay
  }

  private lockScrollPosition() {
    if (this.slideElement?.nativeElement) {
      const slide = this.slideElement.nativeElement;
      const container = slide.closest('.wrapped-slides') as HTMLElement;
      if (container) {
        // Store current scroll position
        this.scrollLockPosition = container.scrollTop;

        // Lock scroll position using requestAnimationFrame
        const lockScroll = () => {
          if (this.isWaitingForDelay && container) {
            if (Math.abs(container.scrollTop - this.scrollLockPosition) > 1) {
              container.scrollTop = this.scrollLockPosition;
            }
            this.scrollLockAnimationFrame = requestAnimationFrame(lockScroll);
          }
        };
        this.scrollLockAnimationFrame = requestAnimationFrame(lockScroll);
      }
    }
  }

  private unlockScrollPosition() {
    if (this.scrollLockAnimationFrame) {
      cancelAnimationFrame(this.scrollLockAnimationFrame);
      this.scrollLockAnimationFrame = undefined;
    }
  }

  canAdvance(): boolean {
    return !this.isWaitingForDelay;
  }

  onContentClick(event: MouseEvent) {
    // Prevent navigation during the 2-second delay period
    if (this.isWaitingForDelay) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
    return true;
  }

  ngOnDestroy() {
    this.unlockScrollPosition();
  }
}

