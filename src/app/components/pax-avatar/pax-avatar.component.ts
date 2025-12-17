import {Component, Input, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {PaxService} from 'src/app/services/pax.service';

@Component({
  selector: 'app-pax-avatar',
  templateUrl: './pax-avatar.component.html',
  styleUrls: ['./pax-avatar.component.scss'],
})
export class PaxAvatarComponent implements OnInit {
  @Input() name!: string;
  @Input() size = 40;
  @Input() clickable = false;

  avatarUrl = '/assets/f3.jpg';
  style?: {width: string, height: string};

  constructor(
      private readonly paxService: PaxService,
      private readonly router: Router,
  ) {}

  ngOnInit() {
    this.loadAvatarUrl();
    this.style = {width: `${this.size}px`, height: `${this.size}px`};
  }

  async loadAvatarUrl() {
    const pax = await this.paxService.getPax(this.name);
    if (pax?.img_url) {
      this.avatarUrl = pax.img_url;
    }
  }

  goToPax($event: Event) {
    if (this.clickable && this.name) {
      $event.preventDefault();
      $event.stopPropagation();
      this.router.navigateByUrl(`/pax/${this.name}`);
    }
  }
}
