import React, { useState, useEffect, useCallback, useRef, createRef } from 'react';
import { Schedule, InputActivity, CalculatedActivity, Rigidity } from '../types';
import { calculateSchedule } from '../logic/calculateSchedule';

// Default data for now
const defaultSchedule: Schedule = {
  startTime: "08:00",
  endTime: "18:00",
  activities: [
    { id: '1', name: 'Morning Routine', duration: 60, rigidity: 'rigid', startTime: '08:00' },
    { id: '2', name: 'Work Block 1', duration: 120, rigidity: 'flexible' },
    { id: '3', name: 'Lunch', duration: 45, rigidity: 'rigid', startTime: '12:00' },
    { id: '4', name: 'Work Block 2', duration: 180, rigidity: 'flexible' },
    { id: '5', name: 'Exercise', duration: 60, rigidity: 'flexible' },
    { id: '6', name: 'Dinner', duration: 45, rigidity: 'rigid', startTime: '18:00' },
  ],
};

interface ScheduleTableProps {
  schedule?: Schedule; // Allow passing a schedule, otherwise use default
}

interface RowRefs {
  nameInput: React.RefObject<HTMLInputElement>;
  timeInput: React.RefObject<HTMLInputElement>;
  durationInput: React.RefObject<HTMLInputElement>;
}

const ScheduleTable: React.FC<ScheduleTableProps> = ({ schedule = defaultSchedule }) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  // State to hold editable activities
  const [editableActivities, setEditableActivities] = useState<InputActivity[]>(() => schedule.activities);
  // State to hold the calculated schedule
  const [calculatedSchedule, setCalculatedSchedule] = useState<CalculatedActivity[]>([]);
  // State for editable schedule start/end times
  const [scheduleStartTime, setScheduleStartTime] = useState<string>(schedule.startTime);
  const [scheduleEndTime, setScheduleEndTime] = useState<string>(schedule.endTime);
  // Refs for input elements in each row
  const rowRefs = useRef<RowRefs[]>([]);

  // Ensure refs array matches the number of activities
  useEffect(() => {
    rowRefs.current = editableActivities.map(
      (_, i) => rowRefs.current[i] ?? { 
          nameInput: createRef<HTMLInputElement>(), 
          timeInput: createRef<HTMLInputElement>(), 
          durationInput: createRef<HTMLInputElement>() 
      }
    );
  }, [editableActivities.length]);

  // Recalculate schedule whenever editableActivities or schedule time boundaries change
  useEffect(() => {
    const newCalculatedSchedule = calculateSchedule(
      editableActivities,
      scheduleStartTime, // Use state variable
      scheduleEndTime    // Use state variable
    );
    setCalculatedSchedule(newCalculatedSchedule);
    // Add scheduleStartTime and scheduleEndTime to dependencies
  }, [editableActivities, scheduleStartTime, scheduleEndTime]);


  // Handle input changes
  const handleInputChange = useCallback((index: number, field: keyof InputActivity, value: string | number | undefined | Rigidity) => {
    setEditableActivities(prevActivities => {
      const newActivities = [...prevActivities];
      const activityToUpdate = { ...newActivities[index] };

      // Use a switch or if/else if for type-safe assignment based on field
      if (field === 'name') {
        activityToUpdate[field] = value as string;
      } else if (field === 'duration') {
        const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
        activityToUpdate[field] = isNaN(numValue as number) ? undefined : numValue;
      } else if (field === 'startTime') {
        activityToUpdate[field] = value === '' ? undefined : value as string | undefined;
      } else if (field === 'rigidity') {
        activityToUpdate[field] = value as Rigidity;
      }
      // Removed the 'else' block with 'any'

      newActivities[index] = activityToUpdate;
      return newActivities;
    });
  }, []);


  // Enhanced useEffect for keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const targetElement = event.target as HTMLElement;

      // Handle Esc key to unfocus inputs/selects first
      if (event.key === 'Escape' && (targetElement.tagName === 'INPUT' || targetElement.tagName === 'SELECT')) {
        targetElement.blur();
        event.preventDefault();
        return; // Stop further processing for Esc
      }

      // Ignore other shortcuts if focus is inside an input or select element
      if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'SELECT') {
        if (['i', 'd', 's', 'r', 'n', 't', 'm'].includes(event.key)) {
             return; // Block these actions when editing
        }
        // Allow j/k navigation even when input focused (optional, current behavior)
      }

      let newFocusedIndex = focusedIndex;
      const newActivities = [...editableActivities];
      let preventDefault = true;

      switch (event.key) {
        case 'j':
          newFocusedIndex = Math.min(focusedIndex + 1, editableActivities.length - 1);
          break;
        case 'k':
          newFocusedIndex = Math.max(focusedIndex - 1, 0);
          break;
        case 'i': { // Insert after current
           const newActivity: InputActivity = {
             id: crypto.randomUUID(),
             name: 'New Activity',
             duration: 0,
             rigidity: 'flexible',
           };
           newActivities.splice(focusedIndex + 1, 0, newActivity);
           newFocusedIndex = focusedIndex + 1;
           setEditableActivities(newActivities);
           break;
         }
        case 'd': { // Delete current
           if (newActivities.length > 1) {
             newActivities.splice(focusedIndex, 1);
             newFocusedIndex = Math.min(focusedIndex, newActivities.length - 1);
             setEditableActivities(newActivities);
           } else {
             console.log("Cannot delete the last activity");
             preventDefault = false;
           }
           break;
        }
        case 's': { // Split current
           const currentActivity = newActivities[focusedIndex];
           if (currentActivity.duration && currentActivity.duration > 1) {
             const halfDuration = Math.floor(currentActivity.duration / 2);
             const remainingDuration = currentActivity.duration - halfDuration;
             const splitActivity: InputActivity = {
               ...currentActivity,
               id: crypto.randomUUID(),
               name: `${currentActivity.name} (split)`,
               duration: remainingDuration,
               startTime: undefined,
             };
             newActivities[focusedIndex] = { ...currentActivity, duration: halfDuration };
             newActivities.splice(focusedIndex + 1, 0, splitActivity);
             setEditableActivities(newActivities);
           } else {
             console.log("Cannot split activity with duration <= 1");
             preventDefault = false;
           }
           break;
        }
        case 'r': { // Toggle rigidity
           const currentRigidity = newActivities[focusedIndex]?.rigidity ?? 'flexible';
           handleInputChange(focusedIndex, 'rigidity', currentRigidity === 'flexible' ? 'rigid' : 'flexible');
           break;
        }
        case 'n': // Focus Name input
          rowRefs.current[focusedIndex]?.nameInput.current?.focus();
          rowRefs.current[focusedIndex]?.nameInput.current?.select();
          break;
        case 't': // Focus Time input
          rowRefs.current[focusedIndex]?.timeInput.current?.focus();
          rowRefs.current[focusedIndex]?.timeInput.current?.select();
          break;
        case 'm': // Focus Minutes (duration) input
          rowRefs.current[focusedIndex]?.durationInput.current?.focus();
          rowRefs.current[focusedIndex]?.durationInput.current?.select();
          break;
         default:
           preventDefault = false;
           break;
      }

      if (preventDefault) {
        event.preventDefault();
      }

      // Update focus only if it changed and wasn't handled by setEditableActivities causing a re-render
      if (newFocusedIndex !== focusedIndex && !['i', 'd', 's'].includes(event.key)) {
           setFocusedIndex(newFocusedIndex);
      }
       else if (event.key === 'i' || event.key === 'd') {
            queueMicrotask(() => setFocusedIndex(newFocusedIndex));
       }

    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusedIndex, editableActivities, handleInputChange, scheduleStartTime, scheduleEndTime]); // Added schedule times to dependencies

  return (
    <div>
      <h2>
        Schedule (
        <input 
            type="text" 
            value={scheduleStartTime}
            onChange={(e) => setScheduleStartTime(e.target.value)} 
            placeholder="HH:MM"
            size={5} // Basic sizing
            style={{ fontSize: 'inherit', border: '1px solid #ccc', padding: '2px' }} // Basic styling
        />
         - 
        <input 
            type="text" 
            value={scheduleEndTime}
            onChange={(e) => setScheduleEndTime(e.target.value)} 
            placeholder="HH:MM"
            size={5}
            style={{ fontSize: 'inherit', border: '1px solid #ccc', padding: '2px' }}
        />
        )
      </h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Start Time (HH:MM)</th>
            <th>Duration (min)</th>
            <th>Rigidity</th>
            <th>Calculated Time</th>
            <th>Calculated Duration</th>
          </tr>
        </thead>
        <tbody>
          {/* Map over editableActivities for inputs, use calculatedSchedule for display */}
          {editableActivities.map((activity, index) => {
             const calculated = calculatedSchedule.find(calc => calc.id === activity.id);
             // Assign refs to the input elements
             const currentRefs = rowRefs.current[index] ?? { 
                 nameInput: createRef<HTMLInputElement>(), 
                 timeInput: createRef<HTMLInputElement>(), 
                 durationInput: createRef<HTMLInputElement>() 
             };
             return (
                <tr key={activity.id} className={index === focusedIndex ? 'focused' : ''}>
                <td>
                    <input
                    ref={currentRefs.nameInput}
                    type="text"
                    value={activity.name}
                    onChange={(e) => handleInputChange(index, 'name', e.target.value)}
                    />
                </td>
                <td>
                    <input
                    ref={currentRefs.timeInput}
                    type="text" 
                    placeholder="HH:MM or empty"
                    value={activity.startTime ?? ''}
                    onChange={(e) => handleInputChange(index, 'startTime', e.target.value)}
                    />
                </td>
                <td>
                    <input
                    ref={currentRefs.durationInput}
                    type="number"
                    min="0"
                    value={activity.duration ?? ''}
                    onChange={(e) => handleInputChange(index, 'duration', e.target.value)}
                    />
                </td>
                <td>
                    <select
                    value={activity.rigidity ?? 'flexible'} // Default to flexible if undefined
                    onChange={(e) => handleInputChange(index, 'rigidity', e.target.value as Rigidity)}
                    >
                    <option value="flexible">flexible</option>
                    <option value="rigid">rigid</option>
                    </select>
                </td>
                {/* Display calculated values */}
                <td>{calculated?.calculatedStartTime ?? '-'}</td>
                <td>{calculated?.calculatedDuration?.toFixed(0) ?? '-'}</td>
                </tr>
             );
          })}
        </tbody>
      </table>
      {/* Display Keyboard Shortcuts - each on its own div */}
      <div style={{ marginTop: '20px', fontFamily: 'monospace' }}>
        <div>Keyboard Shortcuts:</div>
        <div>-------------------</div>
        <div>j/k : Move focus down/up</div>
        <div>i   : Insert row after current</div>
        <div>d   : Delete current row (min 1 row)</div>
        <div>s   : Split current row (if duration {'>'} 1)</div> {/* Use HTML entity for > */}
        <div>r   : Toggle rigidity (flexible/rigid)</div>
        <div>n   : Edit name (focus input)</div>
        <div>t   : Edit time (focus input)</div>
        <div>m   : Edit minutes (focus input)</div>
        <div>Esc : Unfocus from input field</div> {/* Added Esc description */} 
      </div>
    </div>
  );
};

export default ScheduleTable; 