import {Component, OnInit} from '@angular/core';

const exiconData = require('../../../assets/exicon.json');

@Component({
  selector: 'app-exicon',
  templateUrl: './exicon.page.html',
  styleUrls: ['./exicon.page.scss'],
})
export class ExiconPage implements OnInit {
  exercises: any[] = [];
  filteredExercises: any[] = [];

  ngOnInit() {
    // exiconData has a structure with "blogPosts" array
    this.exercises = exiconData.blogPosts;
    this.filteredExercises = [...this.exercises];
  }

  filterList(event: any) {
    const query = event.target.value?.toLowerCase() || '';
    if (!query) {
      this.filteredExercises = [...this.exercises];
      return;
    }
    this.filteredExercises = this.exercises.filter(
        ex => ex.title.toLowerCase().includes(query) ||
            ex.description.toLowerCase().includes(query) ||
            ex.categories.some(
                (c: any) => c.label.toLowerCase().includes(query)));
  }
}
