// Backfill check-ins for the Chlorine November Challenge from the daily
// threads in Slack #chlorinenovemberchallenge.
//
// The PLAN below was hand-parsed from the threads (Nov 1–10). Each row is one
// PAX on one day. Amounts are what that day added; where a PAX only posted a
// running total, the row is the delta from his last total and says so.
//
// Usage (from the repo root):
//   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/<you>_application_default_credentials.json \
//     node scripts/backfill-chlorine-checkins.js                # dry run, every day
//   ... --day 2026-11-03                                        # dry run, one day
//   ... --day 2026-11-03 --apply                                # write that day
//
// Comparison: for each row, whatever the PAX already has logged for that day
// is subtracted per metric, and only the remainder is written. Re-running is
// safe. PAX not yet in the challenge are joined before their first check-in.
const admin = require('../functions/node_modules/firebase-admin');

const CHALLENGE_ID = 'lyulN9Lo26LaY4Gx1SzB';
const CREATED_BY = 'taylor.matt777@gmail.com';
const PAX_API = 'https://f3-scraper-rs.fly.dev/pax/all';
const METRIC = {
  merkins: 'c_mwba0aunwp2x',
  pages: 'c_mwba5x0mun7e',
  date: 'c_mwbc0feilnwz',
};

// slack user id -> label, just for printing
const WHO = {
  U04133WBEHG: 'Big Sky', U09TTLU2KJ5: 'Wet Wipe', U0ACX4KGC3D: 'Chihuahua',
  U094U0XFW23: 'Tasker', U094B8E2R88: 'Glow Stick', U08CN9U6B2Q: 'Icy Hot',
  U040TCA2L1L: 'Old Spice', U0BQMRG2X0E: 'Mixer', U0915TTBDAM: 'C-Battery',
  U09N9LM4G1Z: 'Ice Box', U094G8SH9JN: 'Big Money', U07CDHN60EQ: 'Ditto',
  U041EGM615K: 'Chlorine', U09H305K6G0: 'Foghorn', U0APX0W1KNV: 'Sunshine',
  U08MR6R56CV: 'Victim', U0927G8BKGD: 'Trench', U0B40E8QY4W: 'TeraByte',
  U0BQV527MPC: 'Gatorade',
};

// [date, slackId, merkins, pages, dateNight(0/1), note]
const PLAN = [
  // ---- 11/1 (already entered by hand; only the gap is here) ----
  ['2026-11-01', 'U094U0XFW23', 150, 15, 0, ''],

  // ---- 11/2 ----
  ['2026-11-02', 'U041EGM615K', 165, 0, 0, ''],
  ['2026-11-02', 'U09H305K6G0', 200, 0, 0, ''],
  ['2026-11-02', 'U07CDHN60EQ', 200, 0, 0, ''],
  ['2026-11-02', 'U0APX0W1KNV', 175, 0, 0, 'Posted 165 today, cumulative 175: the extra 10 were never posted for 11/1'],
  ['2026-11-02', 'U08MR6R56CV', 200, 0, 0, ''],
  ['2026-11-02', 'U04133WBEHG', 175, 0, 0, ''],
  ['2026-11-02', 'U094U0XFW23', 120, 0, 0, ''],
  ['2026-11-02', 'U09TTLU2KJ5', 130, 26, 0, ''],
  ['2026-11-02', 'U094B8E2R88', 250, 38, 0, ''],
  ['2026-11-02', 'U08CN9U6B2Q', 130, 0, 0, ''],
  ['2026-11-02', 'U0927G8BKGD', 208, 0, 0, ''],
  ['2026-11-02', 'U0915TTBDAM', 125, 88, 0, ''],
  ['2026-11-02', 'U09N9LM4G1Z', 210, 0, 0, ''],
  ['2026-11-02', 'U0B40E8QY4W', 140, 0, 0, 'Derived from "Merkins: 4.0%" of the 3,500 goal; pages posted as a % of an unknown book'],
  ['2026-11-02', 'U0ACX4KGC3D', 140, 0, 0, ''],
  ['2026-11-02', 'U040TCA2L1L', 60, 0, 0, ''],
  ['2026-11-02', 'U0BQMRG2X0E', 120, 0, 0, ''],
  ['2026-11-02', 'U0BQV527MPC', 130, 0, 0, ''],

  // ---- 11/3 ----
  ['2026-11-03', 'U04133WBEHG', 255, 0, 0, ''],
  ['2026-11-03', 'U08MR6R56CV', 150, 15, 0, ''],
  ['2026-11-03', 'U041EGM615K', 200, 0, 0, ''],
  ['2026-11-03', 'U094U0XFW23', 180, 22, 0, ''],
  ['2026-11-03', 'U09TTLU2KJ5', 150, 22, 0, ''],
  ['2026-11-03', 'U094B8E2R88', 150, 14, 0, ''],
  ['2026-11-03', 'U0ACX4KGC3D', 200, 0, 0, ''],
  ['2026-11-03', 'U09N9LM4G1Z', 210, 8, 1, 'Lunch date in the car at Lucky Peak'],
  ['2026-11-03', 'U0915TTBDAM', 125, 43, 0, ''],
  ['2026-11-03', 'U08CN9U6B2Q', 120, 0, 0, ''],
  ['2026-11-03', 'U040TCA2L1L', 50, 0, 0, ''],
  ['2026-11-03', 'U0927G8BKGD', 142, 0, 0, 'Posted 152 today but total 350 after 208 on 11/2, so 142 logged; "read some pages" (no count)'],
  ['2026-11-03', 'U07CDHN60EQ', 160, 125, 0, 'Finished "How to Talk to Cats" (125 pages over 11/2–11/3)'],
  ['2026-11-03', 'U0B40E8QY4W', 150, 0, 0, 'Derived from "Merkins: 8.3%" of 3,500 (290 total)'],
  ['2026-11-03', 'U0BQV527MPC', 280, 0, 0, 'Posted 260 today but total 410 after 130 on 11/2, so 280 logged'],
  ['2026-11-03', 'U0BQMRG2X0E', 100, 0, 0, ''],

  // ---- 11/4 ----
  ['2026-11-04', 'U07CDHN60EQ', 300, 10, 0, ''],
  ['2026-11-04', 'U0ACX4KGC3D', 170, 0, 0, ''],
  ['2026-11-04', 'U094B8E2R88', 250, 10, 0, ''],
  ['2026-11-04', 'U041EGM615K', 150, 16, 0, ''],
  ['2026-11-04', 'U09N9LM4G1Z', 210, 20, 0, ''],
  ['2026-11-04', 'U0927G8BKGD', 230, 0, 0, 'Total 580 after 350; "read some pages" (no count)'],
  ['2026-11-04', 'U0915TTBDAM', 155, 25, 0, ''],
  ['2026-11-04', 'U0APX0W1KNV', 263, 0, 0, 'Posted 120 today, total 438 after 175 on 11/2: covers 11/3–11/4'],
  ['2026-11-04', 'U094U0XFW23', 150, 8, 0, ''],
  ['2026-11-04', 'U08CN9U6B2Q', 120, 0, 0, ''],
  ['2026-11-04', 'U08MR6R56CV', 150, 15, 0, ''],
  ['2026-11-04', 'U040TCA2L1L', 50, 0, 0, ''],
  ['2026-11-04', 'U09TTLU2KJ5', 100, 12, 0, ''],
  ['2026-11-04', 'U0B40E8QY4W', 140, 0, 0, 'Derived from "Merkins: 12.3%" of 3,500 (430 total)'],
  ['2026-11-04', 'U0BQMRG2X0E', 30, 0, 0, ''],
  ['2026-11-04', 'U04133WBEHG', 120, 0, 0, ''],

  // ---- 11/5 ----
  ['2026-11-05', 'U07CDHN60EQ', 200, 40, 0, ''],
  ['2026-11-05', 'U094U0XFW23', 150, 12, 1, 'Lunch date'],
  ['2026-11-05', 'U041EGM615K', 160, 0, 1, 'Outback'],
  ['2026-11-05', 'U09TTLU2KJ5', 150, 15, 0, ''],
  ['2026-11-05', 'U094B8E2R88', 150, 7, 0, ''],
  ['2026-11-05', 'U0ACX4KGC3D', 50, 0, 0, ''],
  ['2026-11-05', 'U0915TTBDAM', 125, 32, 0, ''],
  ['2026-11-05', 'U09N9LM4G1Z', 210, 0, 0, ''],
  ['2026-11-05', 'U08CN9U6B2Q', 120, 20, 0, ''],
  ['2026-11-05', 'U0B40E8QY4W', 140, 0, 0, 'Derived from "Merkins: 16.3%" of 3,500 (570 total)'],
  ['2026-11-05', 'U0BQMRG2X0E', 100, 0, 0, ''],
  ['2026-11-05', 'U0927G8BKGD', 150, 0, 0, 'Total 730 after 580'],
  ['2026-11-05', 'U08MR6R56CV', 150, 40, 0, ''],
  ['2026-11-05', 'U04133WBEHG', 100, 0, 0, ''],

  // ---- 11/6 ----
  ['2026-11-06', 'U0BQV527MPC', 0, 31, 1, 'Date night in San Diego; "on page 31"'],
  ['2026-11-06', 'U0927G8BKGD', 150, 0, 1, 'Movie date night; total 880 after 730'],
  ['2026-11-06', 'U09TTLU2KJ5', 100, 0, 1, 'Date night week 1'],
  ['2026-11-06', 'U094U0XFW23', 200, 9, 0, ''],
  ['2026-11-06', 'U041EGM615K', 100, 0, 0, ''],
  ['2026-11-06', 'U0BQMRG2X0E', 130, 0, 1, 'Week 1 date done'],
  ['2026-11-06', 'U0915TTBDAM', 125, 30, 0, ''],
  ['2026-11-06', 'U09N9LM4G1Z', 210, 20, 0, ''],
  ['2026-11-06', 'U07CDHN60EQ', 405, 35, 1, 'Posted in the 11/6 thread the next morning ("put on wrong day"); dinner date; to page 85'],
  ['2026-11-06', 'U08MR6R56CV', 150, 30, 0, ''],
  ['2026-11-06', 'U0ACX4KGC3D', 150, 0, 1, 'Date night week 1'],
  ['2026-11-06', 'U08CN9U6B2Q', 120, 10, 1, 'Date night at the flicks'],
  ['2026-11-06', 'U04133WBEHG', 0, 0, 1, ''],
  ['2026-11-06', 'U0B40E8QY4W', 140, 0, 0, 'Derived from "Merkins: 20.3%" of 3,500 (710 total)'],

  // ---- 11/7 ----
  ['2026-11-07', 'U08MR6R56CV', 200, 15, 0, ''],
  ['2026-11-07', 'U0BQV527MPC', 250, 0, 1, 'Date day coffee, Ocean Beach'],
  ['2026-11-07', 'U04133WBEHG', 105, 0, 1, 'Date day'],
  ['2026-11-07', 'U09N9LM4G1Z', 210, 0, 0, ''],
  ['2026-11-07', 'U09TTLU2KJ5', 120, 5, 1, 'Date day for Christmas card pictures'],
  ['2026-11-07', 'U07CDHN60EQ', 0, 0, 1, 'Day date hiking; pages read this day counted on 11/8'],
  ['2026-11-07', 'U094B8E2R88', 300, 0, 1, 'Kleiner Park and The Village'],
  ['2026-11-07', 'U0ACX4KGC3D', 100, 0, 0, ''],
  ['2026-11-07', 'U094U0XFW23', 180, 0, 0, ''],
  ['2026-11-07', 'U0927G8BKGD', 200, 0, 1, 'Date with M'],
  ['2026-11-07', 'U0915TTBDAM', 90, 0, 0, ''],
  ['2026-11-07', 'U08CN9U6B2Q', 60, 0, 0, ''],

  // ---- 11/8 ----
  ['2026-11-08', 'U04133WBEHG', 100, 10, 0, ''],
  ['2026-11-08', 'U094U0XFW23', 140, 24, 0, ''],
  ['2026-11-08', 'U094B8E2R88', 200, 14, 0, ''],
  ['2026-11-08', 'U0APX0W1KNV', 145, 0, 1, 'Total 583 after 438: covers 11/5–11/8; "1 date night done" (day unknown)'],
  ['2026-11-08', 'U0ACX4KGC3D', 150, 0, 0, ''],
  ['2026-11-08', 'U0915TTBDAM', 125, 30, 0, ''],
  ['2026-11-08', 'U09N9LM4G1Z', 210, 0, 0, ''],
  ['2026-11-08', 'U08CN9U6B2Q', 120, 0, 0, ''],
  ['2026-11-08', 'U07CDHN60EQ', 0, 39, 0, 'At page 124 of 275: pages read 11/7–11/8'],
  ['2026-11-08', 'U08MR6R56CV', 50, 15, 0, ''],

  // ---- 11/9 ----
  ['2026-11-09', 'U08MR6R56CV', 50, 20, 0, ''],
  ['2026-11-09', 'U07CDHN60EQ', 425, 26, 0, ''],
  ['2026-11-09', 'U09TTLU2KJ5', 160, 271, 0, 'Two books finished on a long flight'],
  ['2026-11-09', 'U0927G8BKGD', 180, 51, 0, 'First page count posted ("Page 51"); covers reading since 11/2'],
  ['2026-11-09', 'U094B8E2R88', 200, 14, 0, ''],
  ['2026-11-09', 'U09N9LM4G1Z', 240, 0, 0, ''],
  ['2026-11-09', 'U08CN9U6B2Q', 180, 0, 0, ''],
  ['2026-11-09', 'U094U0XFW23', 180, 0, 0, ''],
  ['2026-11-09', 'U0ACX4KGC3D', 200, 0, 0, ''],
  ['2026-11-09', 'U0915TTBDAM', 150, 8, 0, 'Book finished (256/256)'],
  ['2026-11-09', 'U041EGM615K', 105, 9, 0, ''],
  ['2026-11-09', 'U0B40E8QY4W', 308, 0, 0, 'Derived from "Merkins: 29.1%" of 3,500 (1018 total): covers 11/7–11/9'],

  // ---- 11/10 (Ditto already entered by hand) ----
  ['2026-11-10', 'U07CDHN60EQ', 300, 0, 0, ''],
];

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const DAY = args[args.indexOf('--day') + 1];
const onlyDay = args.includes('--day') ? DAY : undefined;

admin.initializeApp({ projectId: 'f3-boise' });
const db = admin.firestore();
const lower = (s) => (s || '').toLowerCase();

async function loadPax() {
  const res = await fetch(PAX_API);
  const all = await res.json();
  const bySlack = new Map();
  for (const p of all) bySlack.set(p.id, { userId: p.email || p.name, paxName: p.name });
  return bySlack;
}

(async () => {
  const pax = await loadPax();
  const [partSnap, logSnap] = await Promise.all([
    db.collection('challenge_participants').where('challengeId', '==', CHALLENGE_ID).get(),
    db.collection('challenge_logs').where('challengeId', '==', CHALLENGE_ID).get(),
  ]);
  const participants = new Set(partSnap.docs.map((d) => lower(d.data().userId)));
  const logs = logSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const rows = PLAN.filter(([date]) => !onlyDay || date === onlyDay);
  const days = [...new Set(rows.map((r) => r[0]))].sort();
  let written = 0, skipped = 0, joined = 0;

  for (const day of days) {
    console.log(`\n=== ${day} ${APPLY ? '(APPLY)' : '(dry run)'} ===`);
    for (const [date, slack, merkins, pages, dateNight, note] of rows.filter((r) => r[0] === day)) {
      const who = pax.get(slack);
      const label = WHO[slack] || slack;
      if (!who) { console.log(`  !! ${label}: not in PAX API, skipped`); skipped++; continue; }

      const wanted = {};
      if (merkins > 0) wanted[METRIC.merkins] = merkins;
      if (pages > 0) wanted[METRIC.pages] = pages;
      if (dateNight > 0) wanted[METRIC.date] = 1;

      // what's already there for this PAX on this day
      const existing = logs.filter((l) => lower(l.userId) === lower(who.userId) && l.date === date);
      const have = {};
      for (const l of existing) for (const [k, v] of Object.entries(l.values || {})) have[k] = (have[k] || 0) + v;

      const toWrite = {};
      for (const [k, v] of Object.entries(wanted)) {
        const remaining = k === METRIC.date ? (have[k] ? 0 : 1) : v - (have[k] || 0);
        if (remaining > 0) toWrite[k] = remaining;
      }
      const fmt = (vals) => Object.entries(vals).map(([k, v]) => `${k === METRIC.merkins ? 'M' : k === METRIC.pages ? 'P' : 'D'}=${v}`).join(' ') || '—';

      if (Object.keys(toWrite).length === 0) {
        console.log(`  = ${label.padEnd(10)} already has ${fmt(have)}`);
        skipped++;
        continue;
      }
      const existingNote = Object.keys(have).length ? ` (has ${fmt(have)})` : '';
      const joinNote = participants.has(lower(who.userId)) ? '' : ' +JOIN';
      console.log(`  + ${label.padEnd(10)} ${fmt(toWrite)}${existingNote}${joinNote}${note ? `  // ${note}` : ''}`);

      if (!APPLY) { written++; continue; }
      if (!participants.has(lower(who.userId))) {
        await db.collection('challenge_participants').add({
          challengeId: CHALLENGE_ID, userId: who.userId, paxName: who.paxName,
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        participants.add(lower(who.userId));
        joined++;
      }
      const log = {
        challengeId: CHALLENGE_ID, userId: who.userId, paxName: who.paxName, date,
        values: toWrite, createdBy: CREATED_BY,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (note) log.note = note;
      const ref = await db.collection('challenge_logs').add(log);
      logs.push({ id: ref.id, ...log });
      written++;
    }
  }
  console.log(`\n${APPLY ? 'Wrote' : 'Would write'} ${written} check-ins, ${skipped} already present/skipped, ${joined} PAX joined.`);
})().catch((e) => { console.error('Error:', e.message); process.exit(1); });
