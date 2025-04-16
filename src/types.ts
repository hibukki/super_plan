export type Rigidity = "flexible" | "rigid";

export interface Activity {
  id: string; // Simple unique ID, can use uuid later if needed
  name: string;
  startTime?: string; // Optional start time, e.g., "09:00"
  duration: number; // Duration in minutes
  rigidity: Rigidity;
  // calculatedTime and calculatedDuration will be handled later
}

export interface Schedule {
  startTime: string; // e.g., "08:00"
  endTime: string; // e.g., "18:00"
  activities: Activity[];
} 