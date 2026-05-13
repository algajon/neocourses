import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ModelSettingsPanel } from './ModelSettingsPanel';
import { ModelSettings } from '../../lib/types';

vi.mock('../../lib/modelClient', () => ({
  testModelEndpoint: vi.fn().mockResolvedValue({ ok: true, reply: 'pong' }),
}));

const settings: ModelSettings = {
  schemaVersion: 1,
  baseUrl: 'http://localhost:11434',
  apiKey: '',
  model: 'qwen2.5:14b',
};

describe('ModelSettingsPanel', () => {
  it('renders all settings fields', () => {
    render(<ModelSettingsPanel settings={settings} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText(/base url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/model name/i)).toBeInTheDocument();
  });

  it('calls onSave and onClose when save button clicked', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<ModelSettingsPanel settings={settings} onSave={onSave} onClose={onClose} />);
    await user.click(screen.getByText(/save settings/i));
    expect(onSave).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('calls test when test button clicked', async () => {
    const user = userEvent.setup();
    const { testModelEndpoint } = await import('../../lib/modelClient');
    render(<ModelSettingsPanel settings={settings} onSave={vi.fn()} onClose={vi.fn()} />);
    await user.click(screen.getByText(/test connection/i));
    expect(testModelEndpoint).toHaveBeenCalled();
  });
});
