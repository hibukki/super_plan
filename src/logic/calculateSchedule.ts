import { InputActivity, CalculatedActivity } from '../types';
import { parseTimeToMinutes, formatMinutesToTime } from './timeUtils';

/**
 * Calculates times and durations within a block of activities
 * defined by a fixed start and end time.
 */
function calculateBlock(
    blockActivities: InputActivity[],
    blockStartTimeMinutes: number,
    blockEndTimeMinutes: number
): CalculatedActivity[] {
    const calculatedBlock: CalculatedActivity[] = [];
    let currentTimeMinutes = blockStartTimeMinutes;
    const totalBlockDuration = blockEndTimeMinutes - blockStartTimeMinutes;

    if (totalBlockDuration < 0) {
        console.error("Block Error: End time is before start time", formatMinutesToTime(blockStartTimeMinutes), formatMinutesToTime(blockEndTimeMinutes));
        // Handle error case: maybe return empty or throw?
        // For now, return partially processed block if any
        return calculatedBlock;
    }

    // --- Initial Pass: Determine fixed points and calculate available time --- (More needed later)

    // --- Simplistic approach for Scenario 1 --- 
    if (blockActivities.length === 1) {
        const activity = blockActivities[0];
        const isStartTimeExplicit = !!activity.startTime;
        const calculatedStartTimeMinutes = isStartTimeExplicit ? parseTimeToMinutes(activity.startTime!) : blockStartTimeMinutes;
        const calculatedStartTime = formatMinutesToTime(calculatedStartTimeMinutes);

        // If start time caused it to start after block start, adjust currentTime
        currentTimeMinutes = Math.max(blockStartTimeMinutes, calculatedStartTimeMinutes);

        const requestedDuration = activity.duration;
        const rigidity = activity.rigidity ?? (requestedDuration ? 'flexible' : 'flexible');

        let calculatedDuration: number;
        let isDurationExplicit: boolean;

        if (requestedDuration !== undefined) {
            // Basic case: duration is specified
            calculatedDuration = requestedDuration;
            // Duration is explicit if it was provided in the input
            isDurationExplicit = true;
        } else {
            // Scenario 1 case: duration is implicit, fills the block
            calculatedDuration = blockEndTimeMinutes - currentTimeMinutes;
            isDurationExplicit = false;
        }

        // TODO: Check if calculatedDuration exceeds block boundaries or specified end_time

        calculatedBlock.push({
            // Provide default values for potentially missing fields from InputActivity
            id: activity.id,
            name: activity.name,
            duration: activity.duration ?? 0,
            rigidity: rigidity,
            // Calculated fields
            calculatedStartTime,
            calculatedDuration,
            isStartTimeExplicit,
            isDurationExplicit,
        });
    } else {
        // --- Handle blocks with multiple activities (Revised Strategy) --- 
        
        // --- Pass 1: Calculate available time for flexible tasks ---
        let totalRigidDuration = 0;
        let totalFlexibleRequestedDuration = 0;
        let flexibleTasksCount = 0;

        blockActivities.forEach(activity => {
            const rigidity = activity.rigidity ?? (activity.duration ? 'flexible' : 'flexible');
            const requestedDuration = activity.duration;

            if (rigidity === 'rigid' && requestedDuration !== undefined) {
                 totalRigidDuration += requestedDuration;
            } else {
                 flexibleTasksCount++;
                 if (requestedDuration !== undefined) {
                     totalFlexibleRequestedDuration += requestedDuration;
                 }
            }
        });

        const availableDurationForBlock = blockEndTimeMinutes - blockStartTimeMinutes;
        const availableForFlex = availableDurationForBlock - totalRigidDuration;

        // --- Determine Durations --- 
        let flexScaleFactor = 1.0;
        let equalFlexDuration = 0;

        if (availableForFlex < 0) {
            console.error("Block Error: Not enough time for rigid tasks. Flexible tasks get 0 duration.");
            flexScaleFactor = 0;
        } else if (flexibleTasksCount > 0) {
             if (totalFlexibleRequestedDuration > 0) {
                 flexScaleFactor = availableForFlex / totalFlexibleRequestedDuration;
             } else if (flexibleTasksCount > 0) {
                 // Only flexible tasks without specified duration
                 equalFlexDuration = availableForFlex / flexibleTasksCount;
             } else {
                // No flexible tasks
                flexScaleFactor = 0; // Should already be 0 if only rigid
             }
        } else {
             // Only rigid tasks in block
        }
        
        // --- Pass 2: Place tasks sequentially --- 
        currentTimeMinutes = blockStartTimeMinutes; // Reset for placement pass
        
        for (const activity of blockActivities) {
            const isStartTimeExplicit = !!activity.startTime;
            const explicitStartTimeMinutes = isStartTimeExplicit ? parseTimeToMinutes(activity.startTime!) : -1;
            const calculatedStartTimeMinutes = isStartTimeExplicit && explicitStartTimeMinutes >= currentTimeMinutes 
                                               ? explicitStartTimeMinutes 
                                               : currentTimeMinutes;
            
            if (calculatedStartTimeMinutes > blockEndTimeMinutes || (calculatedStartTimeMinutes === blockEndTimeMinutes && availableDurationForBlock > 0)) {
                 console.warn(`Activity "${activity.name}" (${activity.id}) cannot start at or after block end time ${formatMinutesToTime(blockEndTimeMinutes)}. Skipping.`);
                 continue; 
            }

            const calculatedStartTime = formatMinutesToTime(calculatedStartTimeMinutes);
            currentTimeMinutes = calculatedStartTimeMinutes;

            const requestedDuration = activity.duration;
            const rigidity = activity.rigidity ?? (requestedDuration ? 'flexible' : 'flexible');
            let calculatedDuration: number;
            let isDurationExplicit: boolean;
            let durationChanged = false;

            if (rigidity === 'rigid' && requestedDuration !== undefined) {
                isDurationExplicit = true; // Rigid is always explicit if requested
                calculatedDuration = requestedDuration;
                 // TODO: Handle scaling down rigid tasks if availableForFlex < 0
                 if (availableForFlex < 0) {
                     // Crude scaling down if needed - this is not fully correct yet
                     // calculatedDuration *= (availableDurationForBlock / totalRigidDuration); // Example scaling
                     console.warn(`Rigid task ${activity.name} duration might need scaling down (not implemented).`);
                 }
                 durationChanged = Math.abs(calculatedDuration - requestedDuration) > 0.001;
            } else {
                // Flexible task (or rigid without duration)
                isDurationExplicit = true; // Assume true unless changed
                if (requestedDuration !== undefined) {
                    // Apply scaling factor
                    calculatedDuration = requestedDuration * flexScaleFactor;
                    durationChanged = Math.abs(calculatedDuration - requestedDuration) > 0.001;
                } else {
                    // No requested duration - assign equal part or 0
                    calculatedDuration = equalFlexDuration; 
                    isDurationExplicit = false; // Implicit because calculated equally
                    durationChanged = calculatedDuration > 0; // Changed if it got time
                }
            }
            
            // Final check for block end boundary
             if (currentTimeMinutes + calculatedDuration > blockEndTimeMinutes) {
                const truncatedDuration = blockEndTimeMinutes - currentTimeMinutes;
                 if (Math.abs(truncatedDuration - calculatedDuration) > 0.001) {
                     durationChanged = true;
                 }
                calculatedDuration = truncatedDuration;
            }
            calculatedDuration = Math.max(0, calculatedDuration);

            // Update explicitness based on whether duration changed
            if (durationChanged) {
                 isDurationExplicit = false;
            }

            calculatedBlock.push({
                id: activity.id,
                name: activity.name,
                duration: activity.duration ?? 0, // Keep original request
                rigidity: rigidity,
                calculatedStartTime,
                calculatedDuration,
                isStartTimeExplicit,
                isDurationExplicit,
            });

            currentTimeMinutes += calculatedDuration;
        }
    }

    return calculatedBlock;
}

export function calculateSchedule(
    activities: InputActivity[],
    scheduleStartTimeStr: string = '09:00',
    scheduleEndTimeStr: string = '17:00'
): CalculatedActivity[] {
    if (!activities || activities.length === 0) {
        return [];
    }

    const scheduleStartMinutes = parseTimeToMinutes(scheduleStartTimeStr);
    const scheduleEndMinutes = parseTimeToMinutes(scheduleEndTimeStr);

    let calculatedActivities: CalculatedActivity[] = [];
    let currentBlock: InputActivity[] = [];
    let lastAnchorTimeMinutes = scheduleStartMinutes;

    for (let i = 0; i < activities.length; i++) {
        const activity = activities[i];
        currentBlock.push(activity);

        // Check if this activity is an anchor point for the *next* block
        // or if it's the last activity.
        const isLastActivity = i === activities.length - 1;
        const nextActivityHasFixedStartTime = !isLastActivity && !!activities[i + 1].startTime;

        if (nextActivityHasFixedStartTime || isLastActivity) {
            let blockEndTimeMinutes: number;

            if (nextActivityHasFixedStartTime) {
                // The start of the next activity defines the end of the current block
                blockEndTimeMinutes = parseTimeToMinutes(activities[i + 1].startTime!);
            } else {
                // The last block ends at the schedule end time
                blockEndTimeMinutes = scheduleEndMinutes;
            }

            // Process the completed block
            const processedBlock = calculateBlock(
                currentBlock,
                lastAnchorTimeMinutes,
                blockEndTimeMinutes
            );
            calculatedActivities = calculatedActivities.concat(processedBlock);

            // Prepare for the next block
            currentBlock = [];
            if (nextActivityHasFixedStartTime) {
                lastAnchorTimeMinutes = blockEndTimeMinutes; // Start time of the next fixed activity
            }
        }
    }

    // TODO: Post-processing might be needed? e.g., handling end_time constraints?

    // Temporary log to see the structure before real calculation
    console.log('Final Calculated (Placeholder):', calculatedActivities);

    return calculatedActivities;
} 