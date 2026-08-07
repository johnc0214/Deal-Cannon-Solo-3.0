import { DateTime } from 'luxon';

export function buildScheduledDateTime(date: string, time: string, timezone: string) {
  return DateTime.fromISO(`${date}T${time}`, { zone: timezone });
}

export function formatLocalDate(dateTime: DateTime) {
  return dateTime.toFormat('yyyy-MM-dd');
}

export function formatLocalTime(dateTime: DateTime) {
  return dateTime.toFormat('HH:mm');
}

export function formatLocalHour(dateTime: DateTime) {
  return dateTime.toFormat('H');
}

export function nowInZone(timezone: string) {
  return DateTime.now().setZone(timezone);
}

export function addDays(date: string, timezone: string, days: number) {
  return DateTime.fromISO(date, { zone: timezone }).plus({ days });
}

export function toUtcIso(dateTime: DateTime) {
  return dateTime.toUTC().toISO({ suppressMilliseconds: false });
}
