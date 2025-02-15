import {Component, OnInit, ViewChild} from '@angular/core';
import {IonInfiniteScroll} from '@ionic/angular';

const exiconData = require('../../../assets/exicon.json') as ExiconData;

export interface ExiconCategory {
  _id: string;
  label: string;
  urlSlug: string;
  description?: string;
  imageUrl?: string;
  imageAltText?: string;
}

export interface ExiconAuthor {
  _id: string;
  socials: any[];  // or a more specific type if you know the shape
  name: string;
  imageUrl?: string;
  imageAltText?: string;
  description?: string;
}

export interface ExiconBlogPost {
  _id: string;
  categories: ExiconCategory[];
  tags: any[];  // or string[] if you know they’re just strings
  type: string;
  title: string;
  description: string;
  imageUrl?: string;
  imageAltText?: string;
  blogId: string;
  urlSlug: string;
  updatedAt?: string;
  author: ExiconAuthor;
  publishedAt?: string;
  scheduledAt?: string|null;
  readTimeInMinutes?: number;
  content?: string;
}

export interface ExiconData {
  blogPosts: ExiconBlogPost[];
}

@Component({
  selector: 'app-exicon',
  templateUrl: './exicon.page.html',
  styleUrls: ['./exicon.page.scss'],
})
export class ExiconPage implements OnInit {
  @ViewChild(IonInfiniteScroll) infiniteScroll: IonInfiniteScroll|undefined;

  allExercises: any[] = [];        // Full data
  filteredExercises: any[] = [];   // After applying search + category filters
  displayedExercises: any[] = [];  // The current chunk shown in the table

  selectedCategories: string[] = [];
  searchQuery = '';

  pageSize = 50;
  currentIndex = 0;

  ngOnInit() {
    const exercises = this.deduplicateExercises(exiconData.blogPosts);
    const sorted = exercises.sort((a, b) => a.title.localeCompare(b.title));
    this.allExercises = sorted;
    this.applyAllFilters();
  }


  // Called whenever the user types in the search bar
  onSearch(event: any) {
    this.searchQuery = (event.target.value || '').toLowerCase().trim();
    this.applyAllFilters();
  }

  addCategory(label: string) {
    // Add the clicked category label to our filters if not already selected
    if (!this.selectedCategories.includes(label)) {
      this.selectedCategories.push(label);
    }
    this.applyAllFilters();
  }

  removeCategory(label: string) {
    this.selectedCategories =
        this.selectedCategories.filter(cat => cat !== label);
    this.applyAllFilters();
  }

  // Consolidated function to apply text + category filters,
  // then reset the infinite scroll to show the first chunk.
  applyAllFilters() {
    // 1. Filter by search text
    let temp = this.searchQuery ?
        this.allExercises.filter(
            ex => ex.title.toLowerCase().includes(this.searchQuery) ||
                ex.description.toLowerCase().includes(this.searchQuery) ||
                ex.categories.some(
                    (c: any) =>
                        c.label.toLowerCase().includes(this.searchQuery))) :
        [...this.allExercises];

    // 2. Filter by selected categories
    if (this.selectedCategories.length > 0) {
      temp = temp.filter(
          exercise => exercise.categories.some(
              (c: any) => this.selectedCategories.includes(c.label)));
    }

    this.filteredExercises = temp;
    this.resetAndLoad();
  }

  // Reset and load first chunk
  resetAndLoad() {
    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = false;
    }
    this.displayedExercises = [];
    this.currentIndex = 0;
    this.loadNextChunk();
  }

  // Load the next chunk of exercises
  loadNextChunk() {
    const nextChunk = this.filteredExercises.slice(
        this.currentIndex, this.currentIndex + this.pageSize);
    this.displayedExercises = [...this.displayedExercises, ...nextChunk];
    this.currentIndex += this.pageSize;
  }

  // Triggered by Ion Infinite Scroll
  loadMore(event: any) {
    this.loadNextChunk();
    event.target.complete();

    // Disable the infinite scroll if we've loaded everything
    if (this.currentIndex >= this.filteredExercises.length) {
      event.target.disabled = true;
    }
  }

  private deduplicateExercises(posts: ExiconBlogPost[]): ExiconBlogPost[] {
    const map = new Map<string, ExiconBlogPost>();

    for (const post of posts) {
      const key = post.title.toLowerCase();
      const existing = map.get(key);

      if (!existing) {
        map.set(key, post);
      } else {
        // Pick whichever has the longer description
        if ((post.description?.length || 0) >
            (existing.description?.length || 0)) {
          // Combine categories
          post.categories =
              this.mergeCategories(existing.categories, post.categories);
          map.set(key, post);
        } else {
          existing.categories =
              this.mergeCategories(existing.categories, post.categories);
        }
      }
    }
    return Array.from(map.values());
  }

  private mergeCategories(c1: ExiconCategory[], c2: ExiconCategory[]):
      ExiconCategory[] {
    const merged = [...c1];
    for (const cat of c2) {
      if (!merged.some(
              x => x.label.toLowerCase() === cat.label.toLowerCase())) {
        merged.push(cat);
      }
    }
    return merged;
  }
}
