export type Status = 'planned' | 'active' | 'done';
export type Task = { id: string; title: string; owner: string; status: Status; notes: string; tag: string };
export const statuses: Status[] = ['planned', 'active', 'done'];
export const labels: Record<Status, string> = { planned: 'Planned', active: 'In progress', done: 'Done' };
export const initialTasks: Task[] = [
  { id: 'FW-101', title: 'Map the first-run experience', owner: 'Maya Chen', status: 'active', tag: 'Research', notes: 'Walk through the welcome flow with three new teammates. Capture the moments where the next step feels unclear.' },
  { id: 'FW-102', title: 'Review the empty states', owner: 'Leo Park', status: 'planned', tag: 'Design', notes: 'Give every empty screen a useful next action. Bring a short copy proposal to the design review.' },
  { id: 'FW-103', title: 'Ship the keyboard shortcuts', owner: 'Ada Rivera', status: 'done', tag: 'Engineering', notes: 'The shortcut menu is ready for a final review. Verify the labels with the support team.' },
  { id: 'FW-104', title: 'Prepare the release checklist', owner: 'Noah Singh', status: 'planned', tag: 'Operations', notes: 'Collect sign-offs from design and engineering before the Thursday release window.' }
];
