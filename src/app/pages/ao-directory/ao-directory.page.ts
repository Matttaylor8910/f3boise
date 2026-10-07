import {Component, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {CurrentPaxService, MyAo} from 'src/app/services/current-pax.service';
import {PaxService} from 'src/app/services/pax.service';
import {UtilService} from 'src/app/services/util.service';
import {Pax} from 'types';

import {CANYON_AOS, CITY_OF_TREES_AOS, DISCONTINUED_AOS, HIGH_DESERT_AOS, REGION_AGNOSTIC_AOS, SETTLERS_AOS} from '../../../../constants';

interface AoLink {
  name: string;
  normalizedName: string;
  route: string;
}

interface RegionSection {
  name: string;
  route: string;
  aos: AoLink[];
}

interface SearchResult {
  name: string;
  kind: 'PAX'|'AO';
  route: string;
}

const MAX_RESULTS = 20;

/**
 * The stats hub: search for a PAX or an AO, jump to your own AOs, and browse
 * every region. This is where the AO tree lives now that it's out of the
 * side menu.
 */
@Component({
  selector: 'app-ao-directory',
  templateUrl: './ao-directory.page.html',
  styleUrls: ['./ao-directory.page.scss'],
})
export class AoDirectoryPage implements OnInit, OnDestroy {
  query = '';
  results: SearchResult[] = [];
  searchLoading = false;

  pax?: Pax;
  myAos: MyAo[] = [];

  regions: RegionSection[] = [];
  regionAgnostic: AoLink[] = [];
  discontinued: AoLink[] = [];
  showDiscontinued = false;

  private paxEntries: SearchResult[] = [];
  private aoEntries: SearchResult[] = [];
  private paxSubscription?: Subscription;

  constructor(
      public readonly utilService: UtilService,
      private readonly router: Router,
      private readonly paxService: PaxService,
      private readonly currentPaxService: CurrentPaxService,
  ) {}

  ngOnInit() {
    const regionAgnostic = REGION_AGNOSTIC_AOS;
    const toLinks = (aos: Set<string>) =>
        Array.from(aos)
            .filter(ao => !regionAgnostic.has(ao))
            .map(ao => this.toLink(ao));

    this.regions = [
      {name: 'Canyon', route: '/region/canyon', aos: toLinks(CANYON_AOS)},
      {
        name: 'City of Trees',
        route: '/region/city-of-trees',
        aos: toLinks(CITY_OF_TREES_AOS)
      },
      {
        name: 'High Desert',
        route: '/region/high-desert',
        aos: toLinks(HIGH_DESERT_AOS)
      },
      {name: 'Settlers', route: '/region/settlers', aos: toLinks(SETTLERS_AOS)},
    ];
    this.regionAgnostic = Array.from(regionAgnostic).map(ao => this.toLink(ao));
    this.discontinued = Array.from(DISCONTINUED_AOS).map(ao => this.toLink(ao));

    const allAos: AoLink[] = [...this.regionAgnostic];
    this.regions.forEach(region => allAos.push(...region.aos));
    this.aoEntries = allAos.map(
        (ao): SearchResult =>
            ({name: ao.normalizedName, kind: 'AO', route: ao.route}));

    this.paxSubscription =
        this.currentPaxService.pax$.subscribe(async (pax: Pax|undefined) => {
          this.pax = pax;
          this.myAos = pax ? await this.currentPaxService.getMyAos(pax.name) :
                             [];
        });
  }

  ngOnDestroy() {
    this.paxSubscription?.unsubscribe();
  }

  async search() {
    const query = this.query.trim().toLowerCase();
    if (!query) {
      this.results = [];
      return;
    }

    if (this.paxEntries.length === 0) {
      this.searchLoading = true;
      try {
        const allPax = await this.paxService.getAllData();
        this.paxEntries =
            allPax
                .map((pax): SearchResult => ({
                       name: this.utilService.normalizeName(pax.name),
                       kind: 'PAX',
                       route: `/pax/${pax.name.toLowerCase()}`,
                     }))
                .sort((a, b) => a.name.localeCompare(b.name));
      } finally {
        this.searchLoading = false;
      }
    }

    const matches = (entry: SearchResult) =>
        entry.name.toLowerCase().includes(query);
    const startsWith = (entry: SearchResult) =>
        entry.name.toLowerCase().startsWith(query);

    // AOs first (there are few of them), then PAX, prefix matches on top
    const aos = this.aoEntries.filter(matches);
    const pax = this.paxEntries.filter(matches);
    const rank = (list: SearchResult[]) =>
        [...list.filter(startsWith), ...list.filter(e => !startsWith(e))];
    this.results = [...rank(aos), ...rank(pax)].slice(0, MAX_RESULTS);
  }

  clearSearch() {
    this.query = '';
    this.results = [];
  }

  go(route: string) {
    this.router.navigateByUrl(route);
  }

  private toLink(ao: string): AoLink {
    return {
      name: ao,
      normalizedName: this.utilService.normalizeName(ao),
      route: `/ao/${ao}`,
    };
  }
}
