const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthPattern = /^\d{4}-\d{2}$/;

function utcDate(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: string, amount: number) {
  const date = utcDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return isoDate(date);
}

function monthEnd(month: string) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return isoDate(date);
}

function shiftMonth(month: string, amount: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount, 1);
  return isoDate(date).slice(0, 7);
}

function validIsoDate(value: unknown): value is string {
  return typeof value === "string"
    && isoDatePattern.test(value)
    && isoDate(utcDate(value)) === value;
}

export type PublicBookingCalendarDay = {
  date: string;
  dayNumber: number;
  inMonth: boolean;
  inBookingWindow: boolean;
};

export type PublicBookingCalendar = {
  month: string;
  label: string;
  queryStart: string;
  queryEnd: string;
  previousMonth: string | null;
  nextMonth: string | null;
  days: PublicBookingCalendarDay[];
};

export function buildPublicBookingCalendar(requestedMonth: unknown, today: string, maxDate: string): PublicBookingCalendar {
  const fallbackMonth = today.slice(0, 7);
  const candidate = typeof requestedMonth === "string" && monthPattern.test(requestedMonth) ? requestedMonth : fallbackMonth;
  const minimumMonth = fallbackMonth;
  const maximumMonth = maxDate.slice(0, 7);
  const month = candidate < minimumMonth || candidate > maximumMonth ? fallbackMonth : candidate;
  const firstOfMonth = `${month}-01`;
  const lastOfMonth = monthEnd(month);
  const gridStart = addDays(firstOfMonth, -utcDate(firstOfMonth).getUTCDay());
  const gridEnd = addDays(lastOfMonth, 6 - utcDate(lastOfMonth).getUTCDay());
  const queryStart = firstOfMonth < today ? today : firstOfMonth;
  const queryEnd = lastOfMonth > maxDate ? maxDate : lastOfMonth;
  const days: PublicBookingCalendarDay[] = [];

  for (let date = gridStart; date <= gridEnd; date = addDays(date, 1)) {
    days.push({
      date,
      dayNumber: Number(date.slice(8, 10)),
      inMonth: date.slice(0, 7) === month,
      inBookingWindow: date >= today && date <= maxDate,
    });
  }

  return {
    month,
    label: new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" }).format(utcDate(firstOfMonth)),
    queryStart,
    queryEnd,
    previousMonth: month > minimumMonth ? shiftMonth(month, -1) : null,
    nextMonth: month < maximumMonth ? shiftMonth(month, 1) : null,
    days,
  };
}

export function selectPublicBookingDate(requestedDate: unknown, availableDates: readonly string[]) {
  return validIsoDate(requestedDate) && availableDates.includes(requestedDate) ? requestedDate : availableDates[0] ?? null;
}
