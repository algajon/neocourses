import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SavedCourseList } from './SavedCourseList';
import { SavedCourse } from '../../lib/types';

const courses: SavedCourse[] = [
  {
    id: '1', schemaVersion: 1, topic: 'React', audience: 'Devs', level: 'beginner',
    goal: 'Build apps', outline: '', createdAt: '', updatedAt: '', projectId: null, tags: [],
  },
  {
    id: '2', schemaVersion: 1, topic: 'Rust', audience: 'Systems devs', level: 'advanced',
    goal: 'Write safe code', outline: '', createdAt: '', updatedAt: '', projectId: null, tags: [],
  },
];

describe('SavedCourseList', () => {
  it('shows empty state when no courses', () => {
    render(<SavedCourseList courses={[]} activeCourseId={null} onSelect={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/no courses yet/i)).toBeInTheDocument();
  });

  it('renders list of courses', () => {
    render(<SavedCourseList courses={courses} activeCourseId={null} onSelect={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Rust')).toBeInTheDocument();
  });

  it('calls onDelete after confirmation', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SavedCourseList courses={courses} activeCourseId={null} onSelect={vi.fn()} onDelete={onDelete} />);
    await user.click(screen.getByLabelText('Delete React'));
    expect(onDelete).toHaveBeenCalledWith('1');
  });

  it('does not delete when confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SavedCourseList courses={courses} activeCourseId={null} onSelect={vi.fn()} onDelete={onDelete} />);
    await user.click(screen.getByLabelText('Delete React'));
    expect(onDelete).not.toHaveBeenCalled();
  });
});
