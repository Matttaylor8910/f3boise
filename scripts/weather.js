// open-meteo-boise-5am-6am-2025.js
// Node 18+ (uses built-in fetch). Outputs JSON to stdout.

const URL =
    'https://archive-api.open-meteo.com/v1/archive?latitude=43.615&longitude=-116.202&start_date=2025-01-01&end_date=2025-12-16&hourly=temperature_2m&timezone=America%2FBoise';

const cToF = (c) => (c * 9) / 5 + 32;
const round1 = (n) => Math.round(n * 10) / 10;

const isWeekend = (yyyyMmDd) => {
  // local date (timezone already applied in API times)
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();  // 0=Sun..6=Sat
  return day === 0 || day === 6;
};

async function main() {
  const res = await fetch(URL, {
    headers: {accept: 'application/json'},
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}\n${text}`);
  }

  const data = await res.json();

  const times = data?.hourly?.time;
  const tempsC = data?.hourly?.temperature_2m;
  if (!Array.isArray(times) || !Array.isArray(tempsC) ||
      times.length !== tempsC.length) {
    throw new Error(
        'Unexpected response shape: hourly.time / hourly.temperature_2m');
  }

  const out = {
    meta: {
      source: 'open-meteo archive',
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone,
      units_in: data.hourly_units,
      rule:
          'Weekdays use 05:00, weekends use 06:00 (local time). Temps converted to °F.',
    },
    daily: [],  // { date, targetTime, isWeekend, tempF }
  };

  // Build quick lookup by time string
  const tempByTime = new Map();
  for (let i = 0; i < times.length; i++) tempByTime.set(times[i], tempsC[i]);

  // Iterate dates from start to end (inclusive)
  const start = '2025-01-01';
  const end = '2025-12-16';

  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);

  let cur = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);

  while (cur <= endDate) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const weekend = isWeekend(dateStr);
    const hour = weekend ? '06:00' : '05:00';
    const key = `${dateStr}T${hour}`;

    const c = tempByTime.get(key);
    if (c != null && Number.isFinite(c)) {
      out.daily.push({
        date: dateStr,
        targetTime: hour,
        isWeekend: weekend,
        tempF: round1(cToF(c)),
      });
    } else {
      out.daily.push({
        date: dateStr,
        targetTime: hour,
        isWeekend: weekend,
        tempF: null,
        missing: true,
      });
    }

    cur.setDate(cur.getDate() + 1);
  }

  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
