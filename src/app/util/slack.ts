import {AO} from '../../../constants';

/** The F3 Boise Slack workspace. */
export const SLACK_WORKSPACE_URL = 'https://f3-boise.slack.com';

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

/**
 * Link into Slack: the AO's channel when we know it, else the workspace.
 * An https link is used rather than the slack:// scheme so it still works
 * without the app installed; phones with Slack open it there anyway.
 */
export function slackUrl(ao?: string): string {
  const channel = ao ? AO_CHANNELS.get(ao.toLowerCase()) : undefined;
  return channel ? `${SLACK_WORKSPACE_URL}/archives/${channel}` :
                   SLACK_WORKSPACE_URL;
}

/** Opens Slack in a new tab (or the Slack app on a phone). */
export function openSlack(ao?: string): void {
  window.open(slackUrl(ao), '_blank', 'noopener');
}
