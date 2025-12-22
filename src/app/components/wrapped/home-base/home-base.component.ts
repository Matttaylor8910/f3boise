import {AfterViewInit, Component, ElementRef, Input, OnChanges, OnInit, SimpleChanges, ViewChild} from '@angular/core';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';

import {GOOGLE_MAPS_API_KEY} from '../../../../../constants';

declare var google: any;

@Component({
  selector: 'app-home-base',
  templateUrl: './home-base.component.html',
  styleUrls: ['./home-base.component.scss'],
})
export class HomeBaseComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() aoName: string = '';
  @Input() posts: number = 0;
  @Input() percentage: number = 0;
  @Input() description: string = '';
  @Input() address: string|null = null;
  @Input() mapLocationUrl: string|null = null;
  @Input()
  backgroundGradient: string =
      'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)';

  @ViewChild('mapContainer', {static: false}) mapContainer!: ElementRef;

  mapEmbedUrl: SafeResourceUrl|null = null;
  mapLinkUrl: string|null = null;
  mapQuery: string|null = null;
  useJavaScriptApi = false;

  constructor(private readonly sanitizer: DomSanitizer) {}

  ngOnInit() {
    this.updateMapUrls();
    this.loadGoogleMapsScript();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['mapLocationUrl'] || changes['address']) {
      this.updateMapUrls();
      if (this.useJavaScriptApi && this.mapQuery) {
        setTimeout(() => this.initMap(), 100);
      }
    }
  }

  ngAfterViewInit() {
    if (this.useJavaScriptApi && this.mapQuery) {
      setTimeout(() => this.initMap(), 100);
    }
  }

  private updateMapUrls() {
    // Reset values
    this.mapEmbedUrl = null;
    this.mapLinkUrl = null;
    this.mapQuery = null;
    this.useJavaScriptApi = false;

    // If map_location_url is available, try to use it
    if (this.mapLocationUrl) {
      // Set link URL
      this.mapLinkUrl = this.mapLocationUrl;

      // If it's already an embed URL, use it directly
      if (this.mapLocationUrl.includes('/embed')) {
        this.mapEmbedUrl =
            this.sanitizer.bypassSecurityTrustResourceUrl(this.mapLocationUrl);
        return;
      }

      // Try to extract place ID or coordinates from the URL
      try {
        const url = new URL(this.mapLocationUrl);

        // Check for place ID in query params
        const placeId =
            url.searchParams.get('cid') || url.searchParams.get('place_id');
        if (placeId) {
          this.mapQuery = `place_id:${placeId}`;
          this.useJavaScriptApi = true;
          return;
        }

        // Check for coordinates in the URL (format: @lat,lng)
        const coordMatch =
            this.mapLocationUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (coordMatch) {
          const lat = coordMatch[1];
          const lng = coordMatch[2];
          this.mapQuery = `${lat},${lng}`;
          this.useJavaScriptApi = true;
          return;
        }

        // Check for a query parameter (address search)
        const query = url.searchParams.get('q');
        if (query) {
          this.mapQuery = query;
          this.useJavaScriptApi = true;
          return;
        }
      } catch (error) {
        console.error('Error processing map URL:', error);
      }
    }

    // If we have an address, use JavaScript API for better control
    if (this.address) {
      this.mapQuery = this.address;
      this.useJavaScriptApi = true;

      // Set link URL if not already set
      if (!this.mapLinkUrl) {
        const encodedAddress = encodeURIComponent(this.address);
        this.mapLinkUrl =
            `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
      }
    }
  }

  private loadGoogleMapsScript() {
    if (typeof google !== 'undefined' && google.maps) {
      return;  // Already loaded
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${
        GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  private initMap() {
    if (!this.mapContainer || !this.mapQuery || typeof google === 'undefined' ||
        !google.maps) {
      return;
    }

    const container = this.mapContainer.nativeElement;
    if (!container) {
      return;
    }

    const geocoder = new google.maps.Geocoder();
    const mapOptions: any = {
      zoom: 17,
      mapTypeId: 'satellite',
      disableDefaultUI: true,
      panControl: false,
      zoomControl: false,
      scaleControl: false,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      gestureHandling: 'none',
      keyboardShortcuts: false,
      styles: [{
        featureType: 'poi',
        stylers: [
          {visibility: 'off'}  // This hides all Points of Interest
        ]
      }]
    };

    const map = new google.maps.Map(container, mapOptions);

    // Geocode the query
    geocoder.geocode({address: this.mapQuery}, (results: any, status: any) => {
      if (status === 'OK' && results && results[0]) {
        map.setCenter(results[0].geometry.location);
        new google.maps.Marker({
          map: map,
          position: results[0].geometry.location,
        });
      } else if (this.mapQuery) {
        // Fallback: try as coordinates
        const coordMatch = this.mapQuery.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
        if (coordMatch) {
          const lat = parseFloat(coordMatch[1]);
          const lng = parseFloat(coordMatch[2]);
          const location = new google.maps.LatLng(lat, lng);
          map.setCenter(location);
          new google.maps.Marker({
            map: map,
            position: location,
          });
        }
      }
    });
  }
}
