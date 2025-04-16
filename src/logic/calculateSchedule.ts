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
            // Duration is explicit only if rigid *and* specified
            isDurationExplicit = rigidity === 'rigid';
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
        // TODO: Handle blocks with multiple activities
        console.warn("Multi-activity block calculation not implemented yet.");
        // Return empty for now to clearly fail tests needing this
        return [];
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