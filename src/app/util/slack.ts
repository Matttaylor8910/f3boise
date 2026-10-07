import {AO} from '../../../constants';

/** The F3 Boise Slack workspace. */
export const SLACK_WORKSPACE_URL = 'https://f3-boise.slack.com';
/** The workspace's Slack team ID, which the app's deep links key on. */
const SLACK_TEAM_ID = 'T03T5J6801Z';
/** How long to give the Slack app to take over before falling back to the web. */
const APP_OPEN_GRACE_MS = 1500;

/**
 * Slack channel for each AO (backblast AO name → channel ID), from the
 * scraper's AO table. An AO missing here opens the workspace instead.
 */
const AO_CHANNELS = new Map<string, string>([
  [AO.BACKYARD, 'C03UEBT1QRZ'],
  [AO.BELLAGIO, 'C045SMRL43X'],
  [AO.BLACK_CANYON, 'C07H4CVU5LH'],
  [AO.BLACK_DIAMOND, 'C04QQF5M8GL'],
  [AO.BLACK_OPS, 'C050HTBNU3B'],
  [AO.BLEACH, 'C03UR7GM7Q9'],
  [AO.CAMELS_BACK, 'C05AJDFUBM4'],
  [AO.COOP, 'C05UUDKULGY'],
  [AO.DARK_STRIDE, 'C06LMEEDC1F'],
  [AO.DUCK_HUNT, 'C07A9KYGG9X'],
  [AO.EMMETT_GEM_ISLAND, 'C09CHL7HL2E'],
  [AO.GEM, 'C03UBFXVBGD'],
  [AO.GOOSE_DYNASTY, 'C06DP3D5VTK'],
  [AO.INTERCEPTOR, 'C077KEU5RQF'],
  [AO.IRON_MOUNTAIN, 'C03TZTTHDPZ'],
  [AO.LIBERTY, 'C07LQPM4X37'],
  // the Nampa site: the same channel under its old OTB name and its AO name
  [AO.LIBERTY_PARK, 'C0A0Z9PB6TE'],
  [AO.OLD_GLORY, 'C03TZTPUFRV'],
  [AO.OTB_CYNTHIA_MANN, 'C09Q3HXVC1M'],
  [AO.OTB_GORDON_HARRIS_PARK, 'C0A5ZDLFLH4'],
  [AO.OTB_LIBERTY_PARK, 'C0A0Z9PB6TE'],
  [AO.OTB_RUCKERSHIP_CANYON, 'C0B903KCR8T'],
  [AO.RAFO, 'C0B4YPPG0LR'],
  [AO.REBEL, 'C03V463RFRN'],
  [AO.RISE, 'C03UT46303T'],
  [AO.RUCKERSHIP_EAST, 'C04EQQZSFQA'],
  [AO.RUCKERSHIP_WEST, 'C03V46DGXMW'],
  [AO.SENTINELS, 'C08QR6U5W2V'],
  [AO.SUNDAY_RUCK, 'C0ATRN16E2U'],
  [AO.THE_EDGE, 'C09GCA1QHFB'],
  [AO.TOWER, 'C04B2DX8CCW'],
  [AO.WAR_HORSE, 'C0425DL9MT7'],
]);

function channelFor(ao?: string): string|undefined {
  return ao ? AO_CHANNELS.get(ao.toLowerCase()) : undefined;
}

/**
 * Web link into Slack: the AO's channel when we know it, else the workspace.
 * Works without the Slack app installed.
 */
export function slackUrl(ao?: string): string {
  const channel = channelFor(ao);
  return channel ? `${SLACK_WORKSPACE_URL}/archives/${channel}` :
                   SLACK_WORKSPACE_URL;
}

/**
 * Slack's own deep link, which opens the app straight to the channel or
 * workspace with no browser in between.
 */
export function slackAppUrl(ao?: string): string {
  const channel = channelFor(ao);
  return channel ? `slack://channel?team=${SLACK_TEAM_ID}&id=${channel}` :
                   `slack://open?team=${SLACK_TEAM_ID}`;
}

/** Phones and tablets, where the Slack app is the better destination. */
function isMobile(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
}

/**
 * Opens Slack. On a phone the app is opened directly through its deep link:
 * an https link from an installed web app opens an in-app browser sheet, and
 * even when iOS hands the page to Slack that blank sheet is left behind. If
 * the app doesn't take over within a moment (not installed), the web link is
 * opened instead. On desktop the web link opens in a new tab.
 */
export function openSlack(ao?: string): void {
  const web = slackUrl(ao);
  if (!isMobile()) {
    window.open(web, '_blank', 'noopener');
    return;
  }

  // if the app opens, the page is hidden and the fallback is cancelled
  const fallback = setTimeout(() => {
    if (document.visibilityState === 'visible') {
      window.open(web, '_blank', 'noopener');
    }
  }, APP_OPEN_GRACE_MS);
  const cancel = () => clearTimeout(fallback);
  document.addEventListener('visibilitychange', cancel, {once: true});
  window.addEventListener('pagehide', cancel, {once: true});
  window.addEventListener('blur', cancel, {once: true});

  window.location.href = slackAppUrl(ao);
}
