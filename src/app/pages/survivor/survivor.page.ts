import {Component, OnInit} from '@angular/core';
import {QLineUp} from 'types';

import {QService} from '../../services/q.service';
import {WorkoutService} from '../../services/workout.service';

@Component({
  selector: 'app-survivor',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>AO Survivor Challenge</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <app-survivor-grid [qLineUps]="qLineUps"></app-survivor-grid>
    </ion-content>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class SurvivorPage implements OnInit {
  qLineUps: QLineUp[] = [];

  constructor(
      private readonly qService: QService,
      private readonly workoutService: WorkoutService) {}

  async ngOnInit() {
    // Load workouts first to ensure they're available
    await this.workoutService.loadAllData();

    // Start date is May 5th, 2025
    const startDate = '2025-05-05';
    // End date is December 31st, 2025 (or adjust as needed)
    const endDate = '2025-12-31';

    try {
      this.qLineUps = await this.qService.getQLineUp(startDate, endDate);
    } catch (error) {
      console.error('Error fetching Q lineup:', error);
    }
  }
}