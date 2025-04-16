export type Rigidity = "flexible" | "rigid";

// Input format for an activity, closer to the user request in tests
export interface InputActivity {
  id: string;
  name: string;
  startTime?: string; // Optional: "HH:MM"
  endTime?: string;   // Optional: "HH:MM"
  duration?: number;  // Optional: duration in minutes
  rigidity?: Rigidity; // Optional: defaults to flexible if duration is provided
}

// Output format after calculation
export interface CalculatedActivity extends Required<Omit<InputActivity, 'startTime' | 'endTime' | 'rigidity'>> {
  rigidity: Rigidity; // Rigidity is always present in output, defaulting from duration if needed
  calculatedStartTime: string; // "HH:MM"
  calculatedDuration: number; // minutes
  isStartTimeExplicit: boolean;
  isDurationExplicit: boolean;
  // We might not need endTime explicitly in the output if we always have start + duration
}

// Schedule definition remains the same for overall boundaries
export interface Schedule {
  startTime: string; // e.g., "08:00"
  endTime: string; // e.g., "18:00"
  // Activities will be processed, maybe use InputActivity[] as input
  // and CalculatedActivity[] as output from the calculation function.
}

// Representing the calculated values with explicit/implicit flag, used in tests
export type CalculatedValue<T> = [T, "explicit" | "implicit"]; 