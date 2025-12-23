import {AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild} from '@angular/core';
import {PaxService} from 'src/app/services/pax.service';
import {WorkoutBuddy} from '../../../interfaces/wrapped-data.interface';

interface PaxBubble {
  name: string;
  posts: number;
  size: number;
  x: number;
  y: number;
  avatarUrl: string;
  animationDelay: number;
  animationDuration: number;
  animationName: string;
}

@Component({
  selector: 'app-pax-network',
  templateUrl: './pax-network.component.html',
  styleUrls: ['./pax-network.component.scss'],
})
export class PaxNetworkComponent implements OnInit, AfterViewInit {
  @Input() totalPax: number = 0;
  @Input() workoutBuddies: WorkoutBuddy[] = [];
  @Input() backgroundGradient: string = 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)';
  @ViewChild('bubbleContainer', {static: false}) bubbleContainer?: ElementRef;

  bubbles: PaxBubble[] = [];
  maxPosts = 0;
  minPosts = 0;
  private containerWidth = 600;
  private containerHeight = 500;

  constructor(private readonly paxService: PaxService) {}

  async ngOnInit() {
    await this.calculateBubbles();
  }

  ngAfterViewInit() {
    // Use setTimeout to ensure container is rendered
    setTimeout(() => {
      if (this.bubbleContainer) {
        const rect = this.bubbleContainer.nativeElement.getBoundingClientRect();
        this.containerWidth = rect.width || 600;
        this.containerHeight = rect.height || 500;
        // Position bubbles randomly
        this.distributeBubbles();
      }
    }, 0);
  }

  private distributeBubbles() {
    if (this.bubbles.length === 0) return;

    // Use most of the container space
    const padding = 30;
    const usableWidth = Math.max(100, this.containerWidth - padding * 2);
    const usableHeight = Math.max(100, this.containerHeight - padding * 2);

    // Random starting position for each bubble, ensuring they're spread out
    this.bubbles.forEach((bubble) => {
      // Ensure bubble fits within bounds
      const maxX = Math.max(padding, usableWidth - bubble.size);
      const maxY = Math.max(padding, usableHeight - bubble.size);

      bubble.x = padding + Math.random() * maxX;
      bubble.y = padding + Math.random() * maxY;
    });
  }

  private async calculateBubbles() {
    if (this.workoutBuddies.length === 0) {
      return;
    }

    // Find min and max posts for scaling
    const posts = this.workoutBuddies.map(b => b.posts);
    this.maxPosts = Math.max(...posts);
    this.minPosts = Math.min(...posts);

    // Calculate bubble properties
    const minSize = 35;
    const maxSize = 70;
    const sizeRange = maxSize - minSize;
    const postsRange = this.maxPosts - this.minPosts;

    // Load avatars and create bubbles - only for pax with profile pictures
    const bubblesWithAvatars = await Promise.all(
      this.workoutBuddies.map(async (buddy) => {
        // Load avatar URL
        const pax = await this.paxService.getPax(buddy.name);
        const avatarUrl = pax?.img_url;

        // Only include if they have a profile picture
        if (!avatarUrl) {
          return null;
        }

        // Size: proportional to posts (more posts = larger bubble)
        const normalizedPosts = postsRange > 0 ?
          (buddy.posts - this.minPosts) / postsRange : 0;
        const size = minSize + (normalizedPosts * sizeRange);

        // Random animation properties for CSS animation
        const animationVariants = [
          'float-around-1',
          'float-around-2',
          'float-around-3',
          'float-around-4',
          'float-around-5',
          'float-around-6',
          'float-around-7',
          'float-around-8'
        ];
        const randomAnimation = animationVariants[Math.floor(Math.random() * animationVariants.length)];

        return {
          name: buddy.name,
          posts: buddy.posts,
          size,
          x: 0, // Will be set in ngAfterViewInit
          y: 0, // Will be set in ngAfterViewInit
          avatarUrl,
          animationDelay: Math.random() * 5, // Random delay 0-5s
          animationDuration: 15 + Math.random() * 10, // Random duration 15-25s
          animationName: randomAnimation,
        };
      })
    );

    // Filter out null values (pax without profile pictures)
    this.bubbles = bubblesWithAvatars.filter(bubble => bubble !== null) as PaxBubble[];
  }

}