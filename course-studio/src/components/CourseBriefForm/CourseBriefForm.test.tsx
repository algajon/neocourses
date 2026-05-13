import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CourseBriefForm } from './CourseBriefForm';

const noop = vi.fn();

describe('CourseBriefForm', () => {
  it('renders all form fields', () => {
    render(<CourseBriefForm onGenerateFake={noop} onGenerateModel={noop} isGenerating={false} hasModelSettings={true} />);
    expect(screen.getByLabelText(/course topic/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target audience/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/difficulty level/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/learning goal/i)).toBeInTheDocument();
  });

  it('calls onGenerateFake with form values when sample button clicked', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<CourseBriefForm onGenerateFake={handler} onGenerateModel={noop} isGenerating={false} hasModelSettings={true} />);
    await user.type(screen.getByLabelText(/course topic/i), 'React Basics');
    await user.type(screen.getByLabelText(/target audience/i), 'New developers');
    await user.type(screen.getByLabelText(/learning goal/i), 'Build a todo app');
    await user.click(screen.getByText(/generate sample/i));
    expect(handler).toHaveBeenCalledWith({
      topic: 'React Basics',
      audience: 'New developers',
      level: 'beginner',
      goal: 'Build a todo app',
    });
  });

  it('shows validation errors when required fields are empty', async () => {
    const user = userEvent.setup();
    render(<CourseBriefForm onGenerateFake={noop} onGenerateModel={noop} isGenerating={false} hasModelSettings={true} />);
    await user.click(screen.getByText(/generate sample/i));
    expect(screen.getAllByText('Required').length).toBeGreaterThan(0);
  });

  it('disables model button when hasModelSettings is false', () => {
    render(<CourseBriefForm onGenerateFake={noop} onGenerateModel={noop} isGenerating={false} hasModelSettings={false} />);
    expect(screen.getByText(/generate with model/i)).toBeDisabled();
  });

  it('disables buttons while generating', () => {
    render(<CourseBriefForm onGenerateFake={noop} onGenerateModel={noop} isGenerating={true} hasModelSettings={true} />);
    expect(screen.getByText(/generate sample/i)).toBeDisabled();
  });
});
