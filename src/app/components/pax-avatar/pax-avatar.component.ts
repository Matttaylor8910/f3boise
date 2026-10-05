import {Component, Input, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import {Router} from '@angular/router';
import {PaxService} from 'src/app/services/pax.service';

const DEFAULT_AVATAR = '/assets/f3.jpg';

@Component({
  selector: 'app-pax-avatar',
  templateUrl: './pax-avatar.component.html',
  styleUrls: ['./pax-avatar.component.scss'],
})
export class PaxAvatarComponent implements OnInit, OnChanges {
  @Input() name!: string;
  @Input() size = 40;
  @Input() clickable = false;

  avatarUrl = DEFAULT_AVATAR;
  style?: {width: string, height: string};

  // ignore avatar loads that resolve after the name has changed again
  private loadToken = 0;

  constructor(
      private readonly paxService: PaxService,
      private readonly router: Router,
  ) {}

  ngOnInit() {
    this.loadAvatarUrl();
    this.style = {width: `${this.size}px`, height: `${this.size}px`};
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['name'] && !changes['name'].firstChange) {
      this.avatarUrl = DEFAULT_AVATAR;
      this.loadAvatarUrl();
    }
    if (changes['size'] && !changes['size'].firstChange) {
      this.style = {width: `${this.size}px`, height: `${this.size}px`};
    }
  }

  async loadAvatarUrl() {
    const token = ++this.loadToken;
    const pax = await this.paxService.getPax(this.name);
    if (token !== this.loadToken) return;
    this.avatarUrl = pax?.img_url || DEFAULT_AVATAR;
  }

  goToPax($event: Event) {
    if (this.clickable && this.name) {
      $event.preventDefault();
      $event.stopPropagation();
      this.router.navigateByUrl(`/pax/${this.name}`);
    }
  }
}
