/**
 * Parses a time string "HH:MM" into minutes since midnight.
 * @param time The time string (e.g., "09:30").
 * @returns The number of minutes since midnight.
 */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time format: ${time}. Expected HH:MM.`);
  }
  return hours * 60 + minutes;
}

/**
 * Formats minutes since midnight into a time string "HH:MM".
 * Ensures hours and minutes are zero-padded.
 * Handles minutes values potentially exceeding a day or being negative (by modulo arithmetic),
 * although typical usage should be within a 0-1439 range.
 * @param totalMinutes The total minutes since midnight.
 * @returns The formatted time string (e.g., "09:30").
 */
export function formatMinutesToTime(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes)) {
       throw new Error(`Invalid input: totalMinutes must be a finite number, got ${totalMinutes}`);
  }
  // Floor to handle potential floating point results from calculations
  const minutesRounded = Math.floor(totalMinutes);

  const hours = Math.floor(minutesRounded / 60) % 24;
  const minutes = minutesRounded % 60;

  // Handle potential negative results from modulo if totalMinutes was negative
  const normalizedHours = (hours < 0 ? hours + 24 : hours);
  const normalizedMinutes = (minutes < 0 ? minutes + 60 : minutes);

  const paddedHours = String(normalizedHours).padStart(2, '0');
  const paddedMinutes = String(normalizedMinutes).padStart(2, '0');

  return `${paddedHours}:${paddedMinutes}`;
}

/**
 * Adds a duration (in minutes) to a time string.
 * @param time The starting time string ("HH:MM").
 * @param duration The duration to add in minutes.
 * @returns The resulting time string ("HH:MM").
 */
export function addMinutesToTime(time: string, duration: number): string {
  const startMinutes = parseTimeToMinutes(time);
  const endMinutes = startMinutes + duration;
  return formatMinutesToTime(endMinutes);
}

/**
 * Calculates the difference between two time strings in minutes.
 * @param timeEnd The ending time string ("HH:MM").
 * @param timeStart The starting time string ("HH:MM").
 * @returns The difference in minutes (can be negative if timeStart is later).
 */
export function timeDifference(timeEnd: string, timeStart: string): number {
  const endMinutes = parseTimeToMinutes(timeEnd);
  const startMinutes = parseTimeToMinutes(timeStart);
  return endMinutes - startMinutes;
} 