import { useState } from 'react';
import { ModelSettings, AppError } from '../../lib/types';
import { UI } from '../../lib/strings';
import { StatusMessage } from '../StatusMessage/StatusMessage';
import { testModelEndpoint } from '../../lib/modelClient';
import styles from './ModelSettingsPanel.module.css';

type Props = {
  settings: ModelSettings;
  onSave: (updates: Partial<ModelSettings>) => void;
  onClose: () => void;
};

export function ModelSettingsPanel({ settings, onSave, onClose }: Props) {
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model);
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testError, setTestError] = useState<AppError | null>(null);

  function handleSave() {
    onSave({ baseUrl, apiKey, model });
    onClose();
  }

  async function handleTest() {
    setTesting(true);
    setTestSuccess(null);
    setTestError(null);
    const result = await testModelEndpoint({ ...settings, baseUrl, apiKey, model });
    setTesting(false);
    if (result.ok) {
      setTestSuccess(`Connection successful. Reply: "${result.reply.slice(0, 80)}…"`);
    } else {
      setTestError(result.error);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={UI.SETTINGS_TITLE}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 className={styles.title}>{UI.SETTINGS_TITLE}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label={UI.CLOSE}>×</button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label htmlFor="baseUrl" className={styles.label}>{UI.SETTINGS_BASE_URL_LABEL}</label>
            <input
              id="baseUrl"
              type="text"
              className={styles.input}
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="apiKey" className={styles.label}>{UI.SETTINGS_API_KEY_LABEL}</label>
            <input
              id="apiKey"
              type="password"
              className={styles.input}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="modelName" className={styles.label}>{UI.SETTINGS_MODEL_LABEL}</label>
            <input
              id="modelName"
              type="text"
              className={styles.input}
              value={model}
              onChange={e => setModel(e.target.value)}
            />
          </div>

          <StatusMessage error={testError} success={testSuccess} />
        </div>

        <div className={styles.footer}>
          <button className={styles.btnSecondary} onClick={handleTest} disabled={testing} type="button">
            {testing ? 'Testing…' : UI.SETTINGS_TEST_BUTTON}
          </button>
          <button className={styles.btnPrimary} onClick={handleSave} type="button">
            {UI.SETTINGS_SAVE_BUTTON}
          </button>
        </div>
      </div>
    </div>
  );
}
