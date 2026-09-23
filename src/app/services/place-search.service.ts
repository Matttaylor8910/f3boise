import {Injectable} from '@angular/core';

/** One row in the location-search suggestion dropdown. */
export interface PlaceSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

/** Resolved place: coordinates plus a structured postal address. */
export interface PlaceDetails {
  lat: number;
  lng: number;
  /** POI display name ("Pipe Dream Park"); '' for plain addresses. */
  name: string;
  formattedAddress: string;
  street: string;
  city: string;
  state: string;
  zip: string;
}

/**
 * Structured street/city/state/zip from Google `address_components`.
 * Exported for testing.
 */
export function parseAddressComponents(
    components: Array<{
      long_name: string; short_name: string; types: string[]
    }>|undefined): {street: string; city: string; state: string; zip: string} {
  const byType = (type: string, short = false): string => {
    const c = components?.find(x => x.types.includes(type));
    return (short ? c?.short_name : c?.long_name) ?? '';
  };
  const streetNumber = byType('street_number');
  const route = byType('route');
  return {
    street: [streetNumber, route].filter(Boolean).join(' '),
    city: byType('locality') || byType('postal_town') ||
        byType('administrative_area_level_3') || byType('sublocality'),
    state: byType('administrative_area_level_1', true),
    zip: byType('postal_code'),
  };
}

/**
 * Whether a picked place's name is a real POI name (worth displaying) rather
 * than an echo of its street address. Exported for testing.
 */
export function isDistinctPlaceName(
    name: string, formattedAddress: string): boolean {
  const n = name.trim();
  if (!n) return false;
  return !formattedAddress.toLowerCase().includes(n.toLowerCase());
}

/**
 * Thin wrapper over the Google Places / Geocoding JS APIs (the Maps script is
 * loaded globally in index.html with `libraries=places`). Groups an
 * autocomplete session: suggestion requests share one session token which is
 * consumed by the following `getDetails` call, per Google's billing model.
 */
@Injectable({providedIn: 'root'})
export class PlaceSearchService {
  private autocomplete?: google.maps.places.AutocompleteService;
  private places?: google.maps.places.PlacesService;
  private sessionToken?: google.maps.places.AutocompleteSessionToken;

  /** False when the Maps script failed to load (offline, blocked, …). */
  get available(): boolean {
    return typeof google !== 'undefined' && !!google.maps?.places;
  }

  private ensureServices(): boolean {
    if (!this.available) return false;
    if (!this.autocomplete) {
      this.autocomplete = new google.maps.places.AutocompleteService();
      // PlacesService requires a host node; a detached div works fine.
      this.places =
          new google.maps.places.PlacesService(document.createElement('div'));
    }
    return true;
  }

  /**
   * Top place predictions for a query, biased toward `near` (typically the
   * current map center) so "Liberty Park" finds the local one.
   */
  getSuggestions(query: string, near?: google.maps.LatLngLiteral):
      Promise<PlaceSuggestion[]> {
    if (!this.ensureServices() || !query.trim()) return Promise.resolve([]);
    this.sessionToken ??= new google.maps.places.AutocompleteSessionToken();
    const request: google.maps.places.AutocompletionRequest = {
      input: query.trim(),
      sessionToken: this.sessionToken,
      ...(near ? {
        locationBias:
            new google.maps.Circle({center: near, radius: 60_000}),
      } :
                  {}),
    };
    return new Promise(resolve => {
      this.autocomplete!.getPlacePredictions(request, (predictions, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK ||
            !predictions) {
          resolve([]);
          return;
        }
        resolve(predictions.slice(0, 5).map(p => ({
          placeId: p.place_id,
          description: p.description,
          mainText: p.structured_formatting?.main_text || p.description,
          secondaryText: p.structured_formatting?.secondary_text || '',
        })));
      });
    });
  }

  /**
   * Resolve a suggestion to coordinates + structured address. Consumes the
   * autocomplete session token. Resolves null on failure.
   */
  getDetails(placeId: string): Promise<PlaceDetails|null> {
    if (!this.ensureServices()) return Promise.resolve(null);
    const token = this.sessionToken;
    this.sessionToken = undefined;
    return new Promise(resolve => {
      this.places!.getDetails(
          {
            placeId,
            fields: [
              'geometry', 'formatted_address', 'name', 'address_components'
            ],
            ...(token ? {sessionToken: token} : {}),
          },
          (place, status) => {
            const point = status === google.maps.places.PlacesServiceStatus.OK &&
                place?.geometry?.location;
            if (!point) {
              resolve(null);
              return;
            }
            const formattedAddress = place!.formatted_address ?? '';
            const name = (place!.name ?? '').trim();
            resolve({
              lat: point.lat(),
              lng: point.lng(),
              name: isDistinctPlaceName(name, formattedAddress) ? name : '',
              formattedAddress,
              ...parseAddressComponents(place!.address_components),
            });
          });
    });
  }

  /**
   * Geocode a street address to lat/lng. Resolves null on any failure so
   * callers can save without moving the pin.
   */
  geocodeAddress(address: string): Promise<google.maps.LatLngLiteral|null> {
    if (!this.available || !address.trim()) return Promise.resolve(null);
    return new Promise(resolve => {
      try {
        new google.maps.Geocoder().geocode({address}, (results, status) => {
          const point = status === 'OK' && results?.[0]?.geometry?.location;
          resolve(point ? point.toJSON() : null);
        });
      } catch {
        resolve(null);
      }
    });
  }
}
