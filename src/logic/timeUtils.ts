/**
 * Converts "HH:MM" time string to minutes since midnight.
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Converts minutes since midnight to "HH:MM" time string.
 * Handles potential floating point minutes by rounding.
 */
export function minutesToTime(totalMinutes: number): string {
  const roundedMinutes = Math.round(totalMinutes);
  const hours = Math.floor(roundedMinutes / 60) % 24; // Handle wrap around midnight if necessary
  const minutes = roundedMinutes % 60;
  const formattedHours = String(hours).padStart(2, '0');
  const formattedMinutes = String(minutes).padStart(2, '0');
  return `${formattedHours}:${formattedMinutes}`;
}

/**
 * Adds minutes to a time represented as minutes since midnight.
 */
export function addMinutes(startMinutes: number, durationMinutes: number): number {
  return startMinutes + durationMinutes;
}

/**
 * Calculates the difference in minutes between two times ("HH:MM").
 */
export function timeDifference(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
} 