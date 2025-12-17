import {Component} from '@angular/core';
import {SidebarService} from 'src/app/services/sidebar.service';

@Component({
  selector: 'app-sidebar-toggle',
  template: `
    <ion-button
      *ngIf="isMobile"
      fill="clear"
      (click)="toggleSidebar()">
      <ion-icon slot="icon-only" name="menu"></ion-icon>
    </ion-button>
  `,
  styles: [`
    :host {
      display: block;
    }

    ion-button {
      --color: var(--ion-color-light, #fff);
    }
  `]
})
export class SidebarToggleComponent {
  isMobile = false;

  constructor(private readonly sidebarService: SidebarService) {
    this.checkMobile();
    window.addEventListener('resize', () => this.checkMobile());
  }

  private checkMobile() {
    this.isMobile = window.innerWidth < 1024;
  }

  toggleSidebar() {
    this.sidebarService.toggle();
  }
}