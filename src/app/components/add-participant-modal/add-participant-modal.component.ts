import {Component, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {IonInfiniteScroll, ModalController, ToastController} from '@ionic/angular';
import {Subject, Subscription} from 'rxjs';
import {debounceTime, distinctUntilChanged} from 'rxjs/operators';
import {Pax} from 'types';

import {ChallengesService} from '../../services/challenges.service';
import {PaxService} from '../../services/pax.service';
import {UtilService} from '../../services/util.service';

interface PaxWithNormalizedName extends Pax {
  normalizedName: string;
  searchableText: string;
}

@Component({
  selector: 'app-add-participant-modal',
  templateUrl: './add-participant-modal.component.html',
  styleUrls: ['./add-participant-modal.component.scss'],
})
export class AddParticipantModalComponent implements OnInit, OnDestroy {
  @Input() challengeId: string = '';
  @Input() existingParticipantIds: string[] = [];
  @ViewChild(IonInfiniteScroll) infiniteScroll?: IonInfiniteScroll;

  allPax: PaxWithNormalizedName[] = [];
  filteredPax: PaxWithNormalizedName[] = [];
  displayedPax: PaxWithNormalizedName[] = [];
  searchQuery = '';
  isLoading = false;
  isAdding = false;
  addingParticipantId: string|null = null;

  private readonly pageSize = 50;
  private currentIndex = 0;
  private searchSubject = new Subject<string>();
  private subscriptions: Subscription[] = [];
  private existingParticipantSet: Set<string> = new Set();

  constructor(
      public readonly utilService: UtilService,
      private readonly modalController: ModalController,
      private readonly toastController: ToastController,
      private readonly challengesService: ChallengesService,
      private readonly paxService: PaxService,
  ) {}

  async ngOnInit() {
    // Build participant set for O(1) lookup
    this.existingParticipantSet = new Set(this.existingParticipantIds);

    // Setup debounced search
    const searchSub = this.searchSubject
                          .pipe(
                              debounceTime(300),
                              distinctUntilChanged(),
                              )
                          .subscribe(() => {
                            this.performSearch();
                          });
    this.subscriptions.push(searchSub);

    // Load data in background - don't block UI
    this.loadPaxData();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.searchSubject.complete();
  }

  private async loadPaxData() {
    this.isLoading = true;
    try {
      const rawPax = await this.paxService.getAllData();
      // Pre-compute normalized names and searchable text once
      this.allPax = rawPax.map(pax => {
        const normalizedName = this.utilService.normalizeName(pax.name);
        return {
          ...pax,
          normalizedName,
          searchableText:
              `${normalizedName} ${pax.name} ${pax.email || ''}`.toLowerCase(),
        };
      });

      // Sort once, not on every filter
      this.allPax.sort(
          (a, b) => a.normalizedName.localeCompare(b.normalizedName));

      // Initial display: show first page
      this.performSearch();
    } catch (error) {
      console.error('Error loading PAX:', error);
      await this.showToast('Failed to load PAX list', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  private performSearch() {
    const query = this.searchQuery.toLowerCase().trim();

    if (!query) {
      // No search: show all (but paginated)
      this.filteredPax = this.allPax;
    } else {
      // Fast search using pre-computed searchable text
      this.filteredPax =
          this.allPax.filter(pax => pax.searchableText.includes(query));
    }

    // Reset pagination
    this.currentIndex = 0;
    this.displayedPax = [];
    this.loadNextChunk();

    // Complete infinite scroll if all items are displayed
    if (this.infiniteScroll) {
      this.infiniteScroll.complete();
      if (this.currentIndex >= this.filteredPax.length) {
        this.infiniteScroll.disabled = true;
      } else {
        this.infiniteScroll.disabled = false;
      }
    }
  }

  onSearchChange() {
    this.searchSubject.next(this.searchQuery);
  }

  loadNextChunk() {
    const nextChunk = this.filteredPax.slice(
        this.currentIndex, this.currentIndex + this.pageSize);
    this.displayedPax = [...this.displayedPax, ...nextChunk];
    this.currentIndex += this.pageSize;
  }

  loadMore(event: any) {
    this.loadNextChunk();
    if (this.infiniteScroll) {
      this.infiniteScroll.complete();
      if (this.currentIndex >= this.filteredPax.length) {
        this.infiniteScroll.disabled = true;
      }
    }
    if (event) {
      event.target.complete();
    }
  }

  isAlreadyParticipant(pax: PaxWithNormalizedName): boolean {
    const userId = pax.email || pax.name;
    return this.existingParticipantSet.has(userId);
  }

  async addParticipant(pax: PaxWithNormalizedName) {
    if (this.isAdding || this.isAlreadyParticipant(pax)) return;

    this.isAdding = true;
    this.addingParticipantId = pax.id;

    try {
      // Use email as userId if available, otherwise use PAX name
      const userId = pax.email || pax.name;
      await this.challengesService.joinChallenge(
          this.challengeId, userId, pax.name);
      await this.showToast(
          `${pax.normalizedName} added successfully!`, 'success');
      // Update existing participants set for O(1) lookup
      this.existingParticipantSet.add(userId);
      this.addingParticipantId = null;
    } catch (error: any) {
      console.error('Error adding participant:', error);
      await this.showToast(
          error.message || 'Failed to add participant. Please try again.',
          'danger',
      );
    } finally {
      this.isAdding = false;
      this.addingParticipantId = null;
    }
  }

  trackByPax(index: number, pax: PaxWithNormalizedName): string {
    return pax.id || pax.name;
  }

  async dismiss() {
    await this.modalController.dismiss();
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
}
