import { InputActivity, CalculatedActivity, Rigidity } from '../types';
import { timeToMinutes, minutesToTime, addMinutes, timeDifference } from './timeUtils'; // Uncomment timeDifference

// Internal representation with minutes for easier calculation
interface ProcessingActivity extends InputActivity {
  startTimeMinutes?: number;
  endTimeMinutes?: number;
  durationMinutes?: number;
  rigidity: Rigidity; // Ensure rigidity is always set
  isStartTimeExplicit: boolean;
  isDurationExplicit: boolean;
  calculatedStartTimeMinutes?: number;
  calculatedDurationMinutes?: number;
}

export function calculateSchedule(
  activities: InputActivity[],
  scheduleStartTime: string = '09:00',
  scheduleEndTime: string = '17:00'
): CalculatedActivity[] {
  const scheduleStartMinutes = timeToMinutes(scheduleStartTime);
  const scheduleEndMinutes = timeToMinutes(scheduleEndTime);

  // 1. Preprocess Activities
  const processingActivities: ProcessingActivity[] = activities.map((act /*, index*/) => {
    const isStartTimeExplicit = act.startTime != null;
    const hasExplicitEndTime = act.endTime != null;
    let duration = act.duration;
    let rigidity: Rigidity = act.rigidity ?? 'flexible';

    // Determine initial explicit duration status
    let isDurationExplicit = (duration != null && rigidity === 'rigid');

    // Handle implied duration from start/end times
    if (act.startTime && hasExplicitEndTime && duration == null) {
      duration = timeDifference(act.startTime, act.endTime!);
      // Duration derived from two fixed points is treated as explicit? Or rigid? Let's say explicit for now.
      isDurationExplicit = true;
      rigidity = 'rigid'; // Make it rigid as it's bounded by fixed points
    }
     // Handle implied start time from end time + duration
    let startTimeMinutes: number | undefined = act.startTime ? timeToMinutes(act.startTime) : undefined;
    const endTimeMinutes: number | undefined = act.endTime ? timeToMinutes(act.endTime) : undefined;
    const durationMinutes: number | undefined = duration;

    if (startTimeMinutes === undefined && endTimeMinutes !== undefined && durationMinutes !== undefined) {
      startTimeMinutes = endTimeMinutes - durationMinutes;
       // Duration provided with end time constraint implies duration is explicit
       isDurationExplicit = true;
       rigidity = 'rigid'; // Effectively rigid due to end constraint
    }


    // Final rigidity check
    if (duration == null && act.startTime == null && act.endTime == null) {
        rigidity = 'flexible'; // Task with no constraints is flexible
        isDurationExplicit = false; // Cannot be explicit without duration
    } else if (rigidity == null && duration != null) {
        rigidity = 'flexible'; // Default to flexible if duration provided but no rigidity
    }


    return {
      ...act,
      startTimeMinutes: startTimeMinutes,
      endTimeMinutes: endTimeMinutes,
      durationMinutes: durationMinutes,
      rigidity: rigidity,
      isStartTimeExplicit: isStartTimeExplicit,
      isDurationExplicit: isDurationExplicit, // Now captures more cases
      calculatedStartTimeMinutes: undefined, // Initialize calculated fields
      calculatedDurationMinutes: undefined,
    };
  });


  // 2. Identify Anchor Points (in minutes)
  const anchors = new Set<number>([scheduleStartMinutes, scheduleEndMinutes]);
  processingActivities.forEach(act => {
    if (act.startTimeMinutes !== undefined && act.isStartTimeExplicit) {
      anchors.add(act.startTimeMinutes);
    }
     // Add explicit end times as anchors too? This might over-constrain or complicate block definitions.
     // Let's stick with start times as primary anchors for now.
     // if (act.endTimeMinutes !== undefined) {
     //    anchors.add(act.endTimeMinutes);
     // }
  });
  const sortedAnchors = Array.from(anchors).sort((a, b) => a - b).filter((v, i, a) => a.indexOf(v) === i); // Ensure unique and sorted


  // 3. Process Blocks Between Anchors
  let activityIndex = 0;
  const finalCalculatedActivities: ProcessingActivity[] = [];
  let lastActivityEndTime = scheduleStartMinutes; // Track the end time of the last placed activity

  for (let i = 0; i < sortedAnchors.length - 1; i++) {
    const blockStart = Math.max(sortedAnchors[i], lastActivityEndTime); // Block can't start before previous ended
    const blockEnd = sortedAnchors[i + 1];
    let blockDuration = blockEnd - blockStart;
    let currentBlockTime = blockStart;

    if (blockDuration <= 0) continue;

    console.log(`Processing block: ${minutesToTime(blockStart)} - ${minutesToTime(blockEnd)} (${blockDuration} min)`);

    // --- Gather Activities for Block --- (Keep this logic)
    const activitiesInBlock: ProcessingActivity[] = [];
    let potentialNextAnchorTime: number | undefined = undefined;

    while (activityIndex < processingActivities.length) {
      const currentActivity = processingActivities[activityIndex];
      if (currentActivity.isStartTimeExplicit && currentActivity.startTimeMinutes !== undefined) {
        if (currentActivity.startTimeMinutes >= blockEnd) {
           potentialNextAnchorTime = Math.min(potentialNextAnchorTime ?? Infinity, currentActivity.startTimeMinutes);
           break;
        }
        if (currentActivity.startTimeMinutes < blockStart) {
          console.error(`Error: Activity ${currentActivity.id} with start time ${minutesToTime(currentActivity.startTimeMinutes)} is out of order or overlaps.`);
          activityIndex++; continue;
        }
        if (currentActivity.startTimeMinutes === blockStart) {
          activitiesInBlock.push(currentActivity); activityIndex++;
        } else { // Starts within the block, acts as next anchor
          potentialNextAnchorTime = Math.min(potentialNextAnchorTime ?? Infinity, currentActivity.startTimeMinutes);
          break;
        }
      } else {
        activitiesInBlock.push(currentActivity); activityIndex++;
      }
    }
     // Adjust block end if an activity inside the block acts as an earlier anchor
     blockDuration = (potentialNextAnchorTime ?? blockEnd) - blockStart;
     const actualBlockEnd = blockStart + blockDuration;
     console.log(` -> Adjusted Block End: ${minutesToTime(actualBlockEnd)}, Duration: ${blockDuration}`);
     // --- End Gather Activities ---

     if (!activitiesInBlock.length) {
         lastActivityEndTime = actualBlockEnd; // Move time forward even if block is empty
         continue; // Skip if no activities fall into this block
     }


    // --- Start Block Allocation Logic ---
    let rigidTimeAllocated = 0;
    let totalRigidDurationRequested = 0;
    const rigidActivities = activitiesInBlock.filter(a => a.rigidity === 'rigid');
    rigidActivities.forEach(a => { totalRigidDurationRequested += a.durationMinutes ?? 0; });

    // Allocate rigid time first
    let rigidScalingFactor = 1.0;
    if (totalRigidDurationRequested > blockDuration) {
      console.warn(` -> Warning: Not enough time for rigid tasks in block ${minutesToTime(blockStart)}-${minutesToTime(actualBlockEnd)}. Scaling down.`);
      rigidScalingFactor = blockDuration / totalRigidDurationRequested;
    }

    rigidActivities.forEach(act => {
      const requestedDuration = act.durationMinutes ?? 0;
      act.calculatedDurationMinutes = requestedDuration * rigidScalingFactor;
      // Duration is only explicit if not scaled *and* originally explicit
      act.isDurationExplicit = rigidScalingFactor === 1.0 && act.isDurationExplicit;
      rigidTimeAllocated += act.calculatedDurationMinutes;
    });

    // Calculate time remaining for flexible tasks
    const availableTimeForFlex = Math.max(0, blockDuration - rigidTimeAllocated);
    let totalFlexDurationRequested = 0;
    const flexibleActivities = activitiesInBlock.filter(a => a.rigidity === 'flexible');
    const flexWithDuration = flexibleActivities.filter(a => a.durationMinutes != null);
    const flexWithoutDuration = flexibleActivities.filter(a => a.durationMinutes == null);

    flexWithDuration.forEach(a => { totalFlexDurationRequested += a.durationMinutes!; });

    // Allocate flexible time
    let flexScalingFactor = 1.0;
    if (flexibleActivities.length > 0) {
      if (availableTimeForFlex <= 0 && totalFlexDurationRequested > 0) {
         console.warn(` -> Warning: No time left for flexible tasks in block ${minutesToTime(blockStart)}-${minutesToTime(actualBlockEnd)}.`);
         flexibleActivities.forEach(act => {
             act.calculatedDurationMinutes = 0;
             act.isDurationExplicit = false;
         });
      } else if (flexWithoutDuration.length > 0 && totalFlexDurationRequested === 0) {
        const durationPerTask = availableTimeForFlex / flexWithoutDuration.length;
        flexWithoutDuration.forEach(act => {
          act.calculatedDurationMinutes = durationPerTask;
          act.isDurationExplicit = false;
        });
      } else if (flexWithoutDuration.length === 0 && totalFlexDurationRequested > 0) {
         // Only tasks with duration
         if (availableTimeForFlex === totalFlexDurationRequested) {
             // Exact match
             flexScalingFactor = 1.0; // Needed for isDurationExplicit check later
             flexWithDuration.forEach(act => {
                 act.calculatedDurationMinutes = act.durationMinutes!;
                 // isDurationExplicit determined later based on final vs request
             });
         } else if (availableTimeForFlex > totalFlexDurationRequested) {
             // Surplus time: Distribute surplus proportionally
             const surplusTime = availableTimeForFlex - totalFlexDurationRequested;
             flexScalingFactor = 1.0; // Base factor is 1, not scaling down

             flexWithDuration.forEach(act => {
                 const proportion = totalFlexDurationRequested > 0 ? (act.durationMinutes! / totalFlexDurationRequested) : (1 / flexWithDuration.length);
                 act.calculatedDurationMinutes = act.durationMinutes! + (surplusTime * proportion);
                 // isDurationExplicit determined later (will be false if duration changed)
             });
         } else {
             // Shortage of time: Scale down proportionally
            flexScalingFactor = totalFlexDurationRequested > 0 ? availableTimeForFlex / totalFlexDurationRequested : 0;
            flexWithDuration.forEach(act => {
                act.calculatedDurationMinutes = act.durationMinutes! * flexScalingFactor;
                // isDurationExplicit determined later (will be false)
            });
         }
      } else if (flexWithoutDuration.length > 0 && totalFlexDurationRequested > 0) {
        // Mix of tasks: Prioritize tasks with duration (up to their request)
        // Distribute remaining time (including surplus) equally to tasks without duration
        const timeForFlexWithDuration = Math.min(availableTimeForFlex, totalFlexDurationRequested);
        let flexWithDurationScaling = 1.0;
        if (totalFlexDurationRequested > 0) {
            flexWithDurationScaling = timeForFlexWithDuration / totalFlexDurationRequested; // Factor is <= 1
        } else {
            flexWithDurationScaling = 1.0;
        }
        let timeUsedByFlexWithDuration = 0;

        flexWithDuration.forEach(act => {
            const allocated = act.durationMinutes! * flexWithDurationScaling;
            act.calculatedDurationMinutes = allocated;
            timeUsedByFlexWithDuration += allocated;
        });

        const remainingTimeForFlexWithout = Math.max(0, availableTimeForFlex - timeUsedByFlexWithDuration);
        const durationPerTaskWithout = flexWithoutDuration.length > 0 ? remainingTimeForFlexWithout / flexWithoutDuration.length : 0;
        flexWithoutDuration.forEach(act => {
            act.calculatedDurationMinutes = durationPerTaskWithout;
        });

      }
    }


    // Set start times sequentially within the block AND finalize explicitness
    activitiesInBlock.forEach(act => {
      act.calculatedStartTimeMinutes = currentBlockTime;
      const duration = act.calculatedDurationMinutes = act.calculatedDurationMinutes ?? 0;
      const originalRequestedDuration = act.durationMinutes;
      const initiallyExplicit = act.isDurationExplicit; // From preprocessing

      // Final check on duration explicitness
      if (act.rigidity === 'rigid') {
           // Explicit only if originally explicit and wasn't scaled down
           act.isDurationExplicit = initiallyExplicit && rigidScalingFactor === 1.0;
      } else { // Flexible
           const durationMatches = originalRequestedDuration != null && Math.abs(duration - originalRequestedDuration) < 0.001;
           // Explicit only if the calculated duration exactly matches the original non-null request
           act.isDurationExplicit = durationMatches;
      }


      // Start time explicitness
      act.isStartTimeExplicit = currentBlockTime === blockStart && act.isStartTimeExplicit;

      finalCalculatedActivities.push(act);
      currentBlockTime = addMinutes(currentBlockTime, duration);
    });

    lastActivityEndTime = Math.max(lastActivityEndTime, currentBlockTime); // Update the end time tracker

    // --- End Block Allocation Logic ---

  }

  // 4. Format Output (Keep this section mostly as is, adjust isDurationExplicit source)
  const finalResult: CalculatedActivity[] = finalCalculatedActivities.map(act => {
      const calculatedStartTime = act.calculatedStartTimeMinutes !== undefined ? minutesToTime(act.calculatedStartTimeMinutes) : scheduleStartTime;
      const calculatedDuration = act.calculatedDurationMinutes !== undefined ? act.calculatedDurationMinutes : 0;
      // Use the isDurationExplicit flag calculated during block processing
      const isDurationExplicit = act.isDurationExplicit;

      return {
        id: act.id,
        name: act.name,
        rigidity: act.rigidity,
        calculatedStartTime: calculatedStartTime,
        calculatedDuration: calculatedDuration,
        isStartTimeExplicit: act.isStartTimeExplicit, // Use flag set during block processing
        isDurationExplicit: isDurationExplicit,
      };
  });

  console.log("Final Calculated Activities:", finalResult); // Log final result for debugging
  return finalResult;
} 