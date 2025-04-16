import { describe, it, expect } from 'vitest';
import { calculateSchedule } from './calculateSchedule';
import type { InputActivity, CalculatedActivity, Rigidity, CalculatedValue } from '../types';

// Helper type for the user request format in scenarios
interface UserRequestActivity {
  name: string;
  start_time?: string;
  end_time?: string;
  duration?: [number, Rigidity]; // [minutes, rigidity]
}

// Helper type for the expected plan format in scenarios
interface ExpectedPlanActivity {
  name: string;
  start_time: CalculatedValue<string>; // [timeString, "explicit" | "implicit"]
  duration: CalculatedValue<number>; // [minutes, "explicit" | "implicit"]
}

interface Scenario {
  scenario: string;
  user_request: Record<string, UserRequestActivity>;
  expected_plan: Record<string, ExpectedPlanActivity>;
  schedule_start_time?: string; // Optional override for default 9:00
  schedule_end_time?: string;   // Optional override for default 17:00
}

// Helper function to convert user_request object to InputActivity array
function formatInput(request: Record<string, UserRequestActivity>): InputActivity[] {
  return Object.entries(request).map(([id, activity]) => ({
    id,
    name: activity.name,
    startTime: activity.start_time,
    endTime: activity.end_time,
    duration: activity.duration?.[0],
    rigidity: activity.duration?.[1] ?? (activity.duration ? 'flexible' : undefined), // Default rigidity if duration exists
  }));
}

// Helper function to convert expected_plan object to a simplified format for comparison
// We compare the core calculated values and their explicitness
function formatExpected(expected: Record<string, ExpectedPlanActivity>): Partial<CalculatedActivity>[] {
    return Object.entries(expected).map(([id, activity]) => ({
    id,
    name: activity.name,
    calculatedStartTime: activity.start_time[0],
    isStartTimeExplicit: activity.start_time[1] === 'explicit',
    // Use expect.closeTo within the test itself for floating point numbers
    calculatedDuration: activity.duration[0],
    isDurationExplicit: activity.duration[1] === 'explicit',
    // Rigidity is implicitly tested by isDurationExplicit and the logic, but could be added if needed
  }));
}


const scenarios: Scenario[] = [
    {
        "scenario": "Two tasks, fixed time for both, first missing a duration",
        "user_request": {
            "1": {"name": "Task 1", "start_time": "09:00"},
            "2": {"name": "Task 2", "start_time": "10:00", "duration": [30, "flexible"]}
        },
        "expected_plan": {
            "1": {"name": "Task 1", "start_time": ["09:00", "explicit"], "duration": [60, "implicit"]},
            "2": {"name": "Task 2", "start_time": ["10:00", "explicit"], "duration": [30, "explicit"]}
        }
    },
    {
        "scenario": "Two tasks, first has fixed time, second is flexible",
        "user_request": {
            "1": {"name": "Meeting", "start_time": "09:00", "duration": [60, "flexible"]},
            "2": {"name": "Work", "duration": [120, "flexible"]}
        },
        "expected_plan": {
            "1": {"name": "Meeting", "start_time": ["09:00", "explicit"], "duration": [60, "explicit"]},
            "2": {"name": "Work", "start_time": ["10:00", "implicit"], "duration": [120, "explicit"]}
        }
    },
    {
        "scenario": "Three tasks with fixed times for first and last",
        "user_request": {
            "1": {"name": "Morning Meeting", "start_time": "09:00", "duration": [30, "flexible"]},
            "2": {"name": "Project Work", "duration": [180, "flexible"]},
            "3": {"name": "Afternoon Meeting", "start_time": "14:00", "duration": [60, "flexible"]}
        },
        "expected_plan": {
            "1": {"name": "Morning Meeting", "start_time": ["09:00", "explicit"], "duration": [30, "explicit"]},
            "2": {"name": "Project Work", "start_time": ["09:30", "implicit"], "duration": [270, "implicit"]},
            "3": {"name": "Afternoon Meeting", "start_time": ["14:00", "explicit"], "duration": [60, "explicit"]}
        }
    },
        {
        "scenario": "Three tasks, middle one has fixed time",
        // Assumes default 9:00 start time
        "user_request": {
            "1": {"name": "Email", "duration": [45, "flexible"]},
            "2": {"name": "Lunch", "start_time": "12:00", "duration": [60, "flexible"]},
            "3": {"name": "Project", "duration": [180, "flexible"]}
        },
        "expected_plan": {
             // Needs schedule end time (e.g., 17:00) to calculate implicit duration for last task
            "1": {"name": "Email", "start_time": ["09:00", "implicit"], "duration": [180, "implicit"]},
            "2": {"name": "Lunch", "start_time": ["12:00", "explicit"], "duration": [60, "explicit"]},
            "3": {"name": "Project", "start_time": ["13:00", "implicit"], "duration": [240, "implicit"]} // Ends at 17:00
        },
        "schedule_end_time": "17:00" // Specify end time for this scenario
    },
    {
        "scenario": "Three flexible tasks, all with requested durations",
        // Assumes default 9:00 start, 17:00 end
        "user_request": {
            "1": {"name": "Task A", "duration": [60, "flexible"]},
            "2": {"name": "Task B", "duration": [120, "flexible"]},
            "3": {"name": "Task C", "duration": [60, "flexible"]}
        },
        "expected_plan": {
            // Total requested: 240 min. Total available: 8 hours = 480 min.
            // Proportional scaling: Factor = 480 / 240 = 2
            "1": {"name": "Task A", "start_time": ["09:00", "implicit"], "duration": [120, "implicit"]},
            "2": {"name": "Task B", "start_time": ["11:00", "implicit"], "duration": [240, "implicit"]},
            "3": {"name": "Task C", "start_time": ["15:00", "implicit"], "duration": [120, "implicit"]}
        }
    },
    {
        "scenario": "Multiple tasks, some with fixed times",
        // Assumes default 9:00 start, 17:00 end
        "user_request": {
            "1": {"name": "Morning Routine", "start_time": "09:00", "duration": [30, "flexible"]},
            "2": {"name": "Email", "duration": [45, "flexible"]},
            "3": {"name": "Team Meeting", "start_time": "11:00", "duration": [60, "flexible"]},
            "4": {"name": "Lunch", "start_time": "12:30", "duration": [45, "flexible"]},
            "5": {"name": "Project Work", "duration": [180, "flexible"]}
        },
        "expected_plan": {
            // Block 1: 9:00 - 11:00 (120 min). Task 1 fixed (30 min), Task 2 flexible (req 45 min).
            // Remaining time for Task 2: 120 - 30 = 90 min.
            "1": {"name": "Morning Routine", "start_time": ["09:00", "explicit"], "duration": [30, "explicit"]},
            "2": {"name": "Email", "start_time": ["09:30", "implicit"], "duration": [90, "implicit"]},
            // Block 2: 11:00 - 12:30 (90 min). Task 3 fixed (60 min).
            "3": {"name": "Team Meeting", "start_time": ["11:00", "explicit"], "duration": [60, "explicit"]},
            // Block 3: 12:30 - 17:00 (270 min). Task 4 fixed (45 min), Task 5 flexible (req 180 min).
            // Remaining time for Task 5: 270 - 45 = 225 min.
            "4": {"name": "Lunch", "start_time": ["12:30", "explicit"], "duration": [45, "explicit"]},
            "5": {"name": "Project Work", "start_time": ["13:15", "implicit"], "duration": [225, "implicit"]} // Fills remaining time until 17:00
        }
    },
    {
        "scenario": "Time crunch - not enough time between fixed tasks",
         // Assumes default 9:00 start, 17:00 end
        "user_request": {
            "1": {"name": "Team Huddle", "start_time": "09:00", "duration": [15, "flexible"]},
            "2": {"name": "Task A", "duration": [60, "flexible"]},
            "3": {"name": "Task B", "duration": [60, "flexible"]},
            "4": {"name": "Client Call", "start_time": "10:30", "duration": [45, "flexible"]}
        },
        "expected_plan": {
            // Block 1: 9:00 - 10:30 (90 min). Task 1 fixed (15 min). Tasks 2, 3 flexible (req 60 + 60 = 120 min).
            // Available time for flex tasks: 90 - 15 = 75 min. Requested: 120 min.
            // Scaling factor: 75 / 120 = 0.625
            "1": {"name": "Team Huddle", "start_time": ["09:00", "explicit"], "duration": [15, "explicit"]},
            "2": {"name": "Task A", "start_time": ["09:15", "implicit"], "duration": [37.5, "implicit"]},
            "3": {"name": "Task B", "start_time": ["09:52.5", "implicit"], "duration": [37.5, "implicit"]},
            "4": {"name": "Client Call", "start_time": ["10:30", "explicit"], "duration": [45, "explicit"]}
        }
    },
    {
        "scenario": "Tasks with rigid durations",
        // Assumes default 9:00 start, 17:00 end
        "user_request": {
            "1": {"name": "Morning Review", "start_time": "09:00", "duration": [30, "flexible"]},
            "2": {"name": "Critical Task", "duration": [60, "rigid"]},
            "3": {"name": "Flexible Task", "duration": [120, "flexible"]},
            "4": {"name": "Lunch Break", "start_time": "12:00", "duration": [60, "flexible"]}
        },
        "expected_plan": {
            // Block 1: 9:00 - 12:00 (180 min). Task 1 fixed (30 min). Task 2 rigid (60 min). Task 3 flexible (req 120 min).
            // Available time for flex tasks: 180 - 30 - 60 = 90 min. Task 3 gets this time.
            "1": {"name": "Morning Review", "start_time": ["09:00", "explicit"], "duration": [30, "explicit"]},
            "2": {"name": "Critical Task", "start_time": ["09:30", "implicit"], "duration": [60, "explicit"]},
            "3": {"name": "Flexible Task", "start_time": ["10:30", "implicit"], "duration": [90, "implicit"]},
            "4": {"name": "Lunch Break", "start_time": ["12:00", "explicit"], "duration": [60, "explicit"]}
        }
    },
     {
        "scenario": "Multiple rigid durations with insufficient time",
        // Assumes default 9:00 start, 17:00 end
        "user_request": {
            "1": {"name": "Meeting A", "start_time": "09:00", "duration": [30, "flexible"]},
            "2": {"name": "Critical Task 1", "duration": [60, "rigid"]},
            "3": {"name": "Critical Task 2", "duration": [60, "rigid"]},
            "4": {"name": "Meeting B", "start_time": "10:30", "duration": [30, "flexible"]}
        },
        "expected_plan": {
            // Block 1: 9:00 - 10:30 (90 min). Task 1 fixed (30 min). Tasks 2, 3 rigid (req 60 + 60 = 120 min).
            // Available time for rigid tasks: 90 - 30 = 60 min. Requested: 120 min.
            // Rigid tasks are scaled down proportionally. Factor = 60 / 120 = 0.5
            "1": {"name": "Meeting A", "start_time": ["09:00", "explicit"], "duration": [30, "explicit"]},
            "2": {"name": "Critical Task 1", "start_time": ["09:30", "implicit"], "duration": [30, "implicit"]},
            "3": {"name": "Critical Task 2", "start_time": ["10:00", "implicit"], "duration": [30, "implicit"]},
            "4": {"name": "Meeting B", "start_time": ["10:30", "explicit"], "duration": [30, "explicit"]}
        }
    },
    {
        "scenario": "Mix of rigid and flexible tasks between fixed points",
        // Assumes default 9:00 start, 17:00 end
        "user_request": {
            "1": {"name": "Morning Standup", "start_time": "09:00", "duration": [15, "flexible"]},
            "2": {"name": "Critical Bug Fix", "duration": [60, "rigid"]},
            "3": {"name": "Documentation", "duration": [120, "flexible"]},
            "4": {"name": "Email", "duration": [30, "flexible"]},
            "5": {"name": "Lunch Break", "start_time": "12:00", "duration": [60, "flexible"]}
        },
        "expected_plan": {
            // Block 1: 9:00 - 12:00 (180 min). Task 1 fixed (15 min). Task 2 rigid (60 min). Tasks 3, 4 flexible (req 120 + 30 = 150 min).
            // Available time for flex tasks: 180 - 15 - 60 = 105 min. Requested: 150 min.
            // Scaling factor for flex tasks: 105 / 150 = 0.7
            "1": {"name": "Morning Standup", "start_time": ["09:00", "explicit"], "duration": [15, "explicit"]},
            "2": {"name": "Critical Bug Fix", "start_time": ["09:15", "implicit"], "duration": [60, "explicit"]},
            "3": {"name": "Documentation", "start_time": ["10:15", "implicit"], "duration": [84, "implicit"]},
            "4": {"name": "Email", "start_time": ["11:39", "implicit"], "duration": [21, "implicit"]},
            "5": {"name": "Lunch Break", "start_time": ["12:00", "explicit"], "duration": [60, "explicit"]}
        }
    },
    {
        "scenario": "Multiple tasks with no specified durations",
         // Assumes default 9:00 start, 17:00 end
        "user_request": {
            "1": {"name": "Morning Meeting", "start_time": "09:00", "duration": [30, "flexible"]},
            "2": {"name": "Work Block A"},
            "3": {"name": "Work Block B"},
            "4": {"name": "Lunch", "start_time": "12:00", "duration": [60, "flexible"]}
        },
        "expected_plan": {
             // Block 1: 9:00 - 12:00 (180 min). Task 1 fixed (30 min). Tasks 2, 3 no duration.
             // Available time for Tasks 2, 3: 180 - 30 = 150 min. Split equally.
            "1": {"name": "Morning Meeting", "start_time": ["09:00", "explicit"], "duration": [30, "explicit"]},
            "2": {"name": "Work Block A", "start_time": ["09:30", "implicit"], "duration": [75, "implicit"]},
            "3": {"name": "Work Block B", "start_time": ["10:45", "implicit"], "duration": [75, "implicit"]},
            "4": {"name": "Lunch", "start_time": ["12:00", "explicit"], "duration": [60, "explicit"]}
        }
    },
     {
        "scenario": "One task with fixed start, one task with no fixed start but fixed end time",
         // Assumes default 9:00 start, 17:00 end
        "user_request": {
            "1": {"name": "Morning Routine", "start_time": "09:00", "duration": [60, "flexible"]},
            "2": {"name": "Work Session", "duration": [180, "flexible"], "end_time": "13:00"}
        },
        "expected_plan": {
            // Task 1 finishes at 10:00. Task 2 must end at 13:00.
            // Task 2 starts implicitly at 10:00. Duration = 13:00 - 10:00 = 180 min.
            // Requested duration (180 min) matches calculated duration.
            "1": {"name": "Morning Routine", "start_time": ["09:00", "explicit"], "duration": [60, "explicit"]},
            "2": {"name": "Work Session", "start_time": ["10:00", "implicit"], "duration": [180, "explicit"]}
        }
    },
    {
        "scenario": "Full day schedule with mix of fixed, rigid, and flexible tasks",
        // Use specified start/end times
        "user_request": {
            "1": {"name": "Morning Routine", "start_time": "07:00", "duration": [60, "flexible"]},
            "2": {"name": "Email", "duration": [30, "flexible"]},
            "3": {"name": "Team Meeting", "start_time": "09:00", "duration": [60, "flexible"]},
            "4": {"name": "Project Work", "duration": [120, "flexible"]},
            "5": {"name": "Lunch", "start_time": "12:00", "duration": [60, "rigid"]},
            "6": {"name": "Critical Task", "duration": [90, "rigid"]},
            "7": {"name": "Admin Work", "duration": [60, "flexible"]},
            "8": {"name": "Learning", "duration": [60, "flexible"]},
            "9": {"name": "Evening Wrap-up", "start_time": "17:00", "duration": [30, "flexible"]}
        },
        "expected_plan": {
            // Block 1: 7:00 - 9:00 (120 min). Task 1 fixed (60 min). Task 2 flex (req 30 min). Available: 60 min.
            "1": {"name": "Morning Routine", "start_time": ["07:00", "explicit"], "duration": [60, "explicit"]},
            "2": {"name": "Email", "start_time": ["08:00", "implicit"], "duration": [60, "implicit"]},
            // Block 2: 9:00 - 12:00 (180 min). Task 3 fixed (60 min). Task 4 flex (req 120 min). Available: 120 min.
            "3": {"name": "Team Meeting", "start_time": ["09:00", "explicit"], "duration": [60, "explicit"]},
            "4": {"name": "Project Work", "start_time": ["10:00", "implicit"], "duration": [120, "implicit"]},
            // Block 3: 12:00 - 17:00 (300 min). Task 5 fixed+rigid (60 min). Task 6 rigid (90 min). Task 7 flex (req 60 min). Task 8 flex (req 60 min).
            // Available time for flex: 300 - 60 - 90 = 150 min. Requested flex: 60 + 60 = 120 min.
            // Flex tasks get more time proportionally. Factor = 150 / 120 = 1.25
            "5": {"name": "Lunch", "start_time": ["12:00", "explicit"], "duration": [60, "explicit"]},
            "6": {"name": "Critical Task", "start_time": ["13:00", "implicit"], "duration": [90, "explicit"]},
            "7": {"name": "Admin Work", "start_time": ["14:30", "implicit"], "duration": [75, "implicit"]},
            "8": {"name": "Learning", "start_time": ["15:45", "implicit"], "duration": [75, "implicit"]},
            // Block 4: 17:00 onwards. Task 9 fixed (30 min).
            "9": {"name": "Evening Wrap-up", "start_time": ["17:00", "explicit"], "duration": [30, "explicit"]}
        },
        "schedule_start_time": "07:00",
        "schedule_end_time": "17:30"
    },
     {
        "scenario": "Tasks with a mix of duration specifications",
         // Assumes default 9:00 start, 17:00 end
        "user_request": {
            "1": {"name": "Task A", "start_time": "09:00"},
            "2": {"name": "Task B", "duration": [60, "flexible"]},
            "3": {"name": "Task C", "duration": [90, "rigid"]},
            "4": {"name": "Task D"},
            "5": {"name": "Task E", "start_time": "13:00", "duration": [60, "flexible"]}
        },
        "expected_plan": {
            // Block 1: 9:00 - 13:00 (240 min). Task 1 fixed start, no duration. Task 2 flex (60 min). Task 3 rigid (90 min). Task 4 no duration.
            // Rigid takes precedence: 90 min. Available for Task 1, 2, 4: 240 - 90 = 150 min.
            // Task 2 flex requests 60 min. Available for Task 1, 4: 150 - 60 = 90 min.
            // Split 90 min equally between Task 1 and Task 4.
            "1": {"name": "Task A", "start_time": ["09:00", "explicit"], "duration": [45, "implicit"]},
            "2": {"name": "Task B", "start_time": ["09:45", "implicit"], "duration": [60, "explicit"]},
            "3": {"name": "Task C", "start_time": ["10:45", "implicit"], "duration": [90, "explicit"]},
            "4": {"name": "Task D", "start_time": ["12:15", "implicit"], "duration": [45, "implicit"]},
            "5": {"name": "Task E", "start_time": ["13:00", "explicit"], "duration": [60, "explicit"]}
        }
    },
    {
        "scenario": "All tasks with fixed times but some missing durations",
        // Assumes default 9:00 start, 17:00 end
        "user_request": {
            "1": {"name": "Task A", "start_time": "09:00", "duration": [30, "flexible"]},
            "2": {"name": "Task B", "start_time": "10:00"},
            "3": {"name": "Task C", "start_time": "11:00", "duration": [60, "flexible"]},
            "4": {"name": "Task D", "start_time": "13:00"}
        },
        "expected_plan": {
            // Task 1: 9:00 - 9:30 (Fixed)
            "1": {"name": "Task A", "start_time": ["09:00", "explicit"], "duration": [30, "explicit"]},
            // Task 2: Starts 10:00 (Fixed), ends when Task 3 starts (11:00). Duration = 60 min.
            "2": {"name": "Task B", "start_time": ["10:00", "explicit"], "duration": [60, "implicit"]},
             // Task 3: 11:00 - 12:00 (Fixed)
            "3": {"name": "Task C", "start_time": ["11:00", "explicit"], "duration": [60, "explicit"]},
            // Task 4: Starts 13:00 (Fixed), ends at schedule end (17:00). Duration = 240 min.
            "4": {"name": "Task D", "start_time": ["13:00", "explicit"], "duration": [240, "implicit"]}
        }
    }
];

describe('calculateSchedule', () => {
  scenarios.forEach((scenario) => {
    it(scenario.scenario, () => {
      const inputActivities = formatInput(scenario.user_request);
      const expectedPartialActivities = formatExpected(scenario.expected_plan);

      const result = calculateSchedule(
        inputActivities,
        scenario.schedule_start_time,
        scenario.schedule_end_time
      );

      // Check length first
      expect(result.length).toBe(expectedPartialActivities.length);

      // Check each activity partially, handling floating point comparison
      expectedPartialActivities.forEach((expectedActivity, index) => {
        const actualActivity = result[index];
        expect(actualActivity.id).toBe(expectedActivity.id);
        expect(actualActivity.name).toBe(expectedActivity.name);
        expect(actualActivity.calculatedStartTime).toBe(expectedActivity.calculatedStartTime);
        expect(actualActivity.isStartTimeExplicit).toBe(expectedActivity.isStartTimeExplicit);
        expect(actualActivity.isDurationExplicit).toBe(expectedActivity.isDurationExplicit);
        // Use toBeCloseTo for duration comparison
        expect(actualActivity.calculatedDuration).toBeCloseTo(expectedActivity.calculatedDuration!);
      });
    });
  });
}); 