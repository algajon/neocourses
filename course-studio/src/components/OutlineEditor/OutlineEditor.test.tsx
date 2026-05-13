import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { OutlineEditor } from './OutlineEditor';
import { SavedCourse } from '../../lib/types';

const baseCourse: SavedCourse = {
  id: 'abc',
  schemaVersion: 1,
  topic: 'TypeScript 101',
  audience: 'Devs',
  level: 'beginner',
  goal: 'Write typed code',
  outline: '## Module 1\n### Lesson 1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  projectId: null,
  tags: [],
};

describe('OutlineEditor', () => {
  it('renders outline content', () => {
    render(<OutlineEditor course={baseCourse} onSave={vi.fn()} onExport={vi.fn()} />);
    expect(screen.getByDisplayValue(/## Module 1/)).toBeInTheDocument();
  });

  it('shows unsaved indicator after editing', async () => {
    const user = userEvent.setup();
    render(<OutlineEditor course={baseCourse} onSave={vi.fn()} onExport={vi.fn()} />);
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, ' extra');
    expect(screen.getByTitle(/unsaved/i)).toBeInTheDocument();
  });

  it('clears unsaved indicator after save', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<OutlineEditor course={baseCourse} onSave={onSave} onExport={vi.fn()} />);
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, ' extra');
    await user.click(screen.getByText(/save course/i));
    expect(screen.queryByTitle(/unsaved/i)).not.toBeInTheDocument();
    expect(onSave).toHaveBeenCalled();
  });
});
