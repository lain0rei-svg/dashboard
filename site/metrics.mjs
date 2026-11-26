const day = 86400000;
const iso = time => new Date(time).toISOString().slice(0, 10);

function lastWeekday(time) {
  while ([0, 6].includes(new Date(time).getUTCDay())) time -= day;
  return iso(time);
}

export function returns(history) {
  const latest = history.at(-1);
  if (!latest) return [null, null, null];
  const time = Date.parse(latest.date);
  const date = new Date(time);
  const monday = time - ((date.getUTCDay() + 6) % 7) * day;
  const first = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  const compare = start => {
    const base = history.find(row => row.date === lastWeekday(start - day));
    return base ? (Number(latest.nav) / Number(base.nav) - 1) * 100 : null;
  };
  return [latest.daily ?? null, compare(monday), compare(first)];
}

export function windowRows(history, range) {
  const latest = history.at(-1);
  if (!latest || range === 'all') return history;
  const time = Date.parse(latest.date);
  const cutoff = new Date(time);
  if (range === 'year') {
    const month = cutoff.getUTCMonth();
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
    if (cutoff.getUTCMonth() !== month) cutoff.setUTCDate(0);
  } else {
    cutoff.setTime(time - Number(range) * day);
  }
  return history.filter(row => row.date >= iso(cutoff));
}
