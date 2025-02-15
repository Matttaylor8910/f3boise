import {Component, OnInit} from '@angular/core';
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
  private allExercises: any[] = [];
  public filteredExercises: any[] = [];
  public displayedExercises: any[] = [];

  private pageSize = 50;
  private currentIndex = 0;

  ngOnInit() {
    this.allExercises = exiconData.blogPosts.sort((a, b) => {
      return a.title.localeCompare(b.title);
    });
    this.filteredExercises = [...this.allExercises];
    this.loadInitial();
  }

  loadInitial() {
    this.currentIndex = 0;
    this.displayedExercises =
        this.filteredExercises.slice(this.currentIndex, this.pageSize);
    this.currentIndex = this.pageSize;
  }

  filterList(event: any) {
    const query = event.target.value?.toLowerCase() || '';
    if (!query) {
      this.filteredExercises = [...this.allExercises];
    } else {
      this.filteredExercises = this.allExercises.filter(
          ex => ex.title.toLowerCase().includes(query) ||
              ex.description.toLowerCase().includes(query) ||
              ex.categories.some(
                  (c: any) => c.label.toLowerCase().includes(query)));
    }
    this.loadInitial();
  }

  loadMore(event: any) {
    // Load next chunk
    const nextChunk = this.filteredExercises.slice(
        this.currentIndex, this.currentIndex + this.pageSize);
    this.displayedExercises = [...this.displayedExercises, ...nextChunk];
    this.currentIndex += this.pageSize;

    // Complete infinite scroll
    event.target.complete();

    // If we've loaded all items, disable the infinite scroll
    if (this.currentIndex >= this.filteredExercises.length) {
      event.target.disabled = true;
    }
  }
}
