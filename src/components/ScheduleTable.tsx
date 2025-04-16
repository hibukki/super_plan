import React, { useState, useEffect } from 'react';
import { Schedule } from '../types';

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

const ScheduleTable: React.FC<ScheduleTableProps> = ({ schedule = defaultSchedule }) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'j') {
        setFocusedIndex((prevIndex) => Math.min(prevIndex + 1, schedule.activities.length - 1));
      } else if (event.key === 'k') {
        setFocusedIndex((prevIndex) => Math.max(prevIndex - 1, 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [schedule.activities.length]);

  return (
    <div>
      <h2>Schedule ({schedule.startTime} - {schedule.endTime})</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Start Time</th>
            <th>Duration (min)</th>
            <th>Rigidity</th>
            {/*<th>Calculated Time</th>*/}
            {/*<th>Calculated Duration</th>*/}
          </tr>
        </thead>
        <tbody>
          {schedule.activities.map((activity, index) => (
            <tr key={activity.id} className={index === focusedIndex ? 'focused' : ''}>
              <td>{activity.name}</td>
              <td>{activity.startTime || '-'}</td>
              <td>{activity.duration}</td>
              <td>{activity.rigidity}</td>
              {/*<td>Calculated Time Placeholder</td>*/}
              {/*<td>Calculated Duration Placeholder</td>*/}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ScheduleTable; 