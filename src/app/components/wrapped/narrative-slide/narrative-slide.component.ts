import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-narrative-slide',
  templateUrl: './narrative-slide.component.html',
  styleUrls: ['./narrative-slide.component.scss'],
})
export class NarrativeSlideComponent {
  @Input() title: string = '';
  @Input() message: string = '';
  @Input() backgroundGradient: string = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  @Input() icon: string = '';
  @Input() imageUrl: string = '';
}

