/**
 * Generate an array of Date objects for the first of each month
 * from `start` to `end` (inclusive).
 */
export function generateMonthlySequence(start, end) {
  const seq = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(),   end.getMonth(),   1);

  while (cur <= last) {
    seq.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }

  return seq;
}

/**
 * Test if two dates fall in the same year+month.
 */
export function sameMonth(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth()    === d2.getMonth()
  );
}