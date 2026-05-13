import { useState, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import styles from './ImportPanel.module.css';

export type FileType = 'pdf' | 'audio' | 'video' | 'doc';

export type ImportedFile = {
  id: string;
  name: string;
  type: FileType;
};

const FILE_META: Record<FileType, { icon: string; color: string; label: string }> = {
  pdf:   { icon: '📄', color: '#ef4444', label: 'PDF' },
  audio: { icon: '🎵', color: '#0ea5e9', label: 'Audio' },
  video: { icon: '🎬', color: '#f97316', label: 'Video' },
  doc:   { icon: '📝', color: '#3b82f6', label: 'Document' },
};

const ACCEPT_EXTS: Record<FileType, string[]> = {
  pdf:   ['pdf'],
  audio: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'opus'],
  video: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'mxf'],
  doc:   ['doc', 'docx', 'txt', 'md', 'rtf', 'odt'],
};

function getFileType(name: string): FileType {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  for (const [type, exts] of Object.entries(ACCEPT_EXTS)) {
    if (exts.includes(ext)) return type as FileType;
  }
  return 'doc';
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type Props = {
  onGenerate: (files: ImportedFile[], audience: string, level: string) => void;
  isGenerating: boolean;
};

export function ImportPanel({ onGenerate, isGenerating }: Props) {
  const [files, setFiles] = useState<ImportedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [audience, setAudience] = useState('');
  const [level, setLevel] = useState('beginner');
  const dropRef = useRef<HTMLDivElement>(null);

  function addFileNames(names: string[]) {
    const next: ImportedFile[] = names.map(n => ({
      id: uid(),
      name: n.split(/[\\/]/).pop() ?? n,
      type: getFileType(n),
    }));
    setFiles(prev => [...prev, ...next]);
  }

  async function handleBrowse() {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'All supported',
            extensions: [
              ...ACCEPT_EXTS.pdf, ...ACCEPT_EXTS.doc,
              ...ACCEPT_EXTS.audio, ...ACCEPT_EXTS.video,
            ],
          },
        ],
      });
      if (selected) {
        addFileNames(Array.isArray(selected) ? selected : [selected]);
      }
    } catch (_) {}
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const names = Array.from(e.dataTransfer.files).map(f => f.name);
    addFileNames(names);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M9 17H7A5 5 0 0 1 7 7h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M15 7h1a5 5 0 0 1 0 10h-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <h2 className={styles.title}>Import & Generate</h2>
          <p className={styles.subtitle}>
            Drop in PDFs, audio recordings, videos, or manuals. neoCourses will extract the content and build a structured course outline instantly. No manual writing required.
          </p>
        </div>
      </div>

      {/* Accepted types */}
      <div className={styles.typeRow}>
        {(Object.keys(FILE_META) as FileType[]).map(type => (
          <div key={type} className={styles.typeChip} style={{ '--chip-color': FILE_META[type].color } as React.CSSProperties}>
            <span>{FILE_META[type].icon}</span>
            <span>{FILE_META[type].label}</span>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        ref={dropRef}
        className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ''} ${files.length > 0 ? styles.dropZoneCompact : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={handleBrowse}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && handleBrowse()}
        aria-label="Drop files or click to browse"
      >
        <div className={styles.dropInner}>
          <div className={`${styles.dropIcon} ${dragOver ? styles.dropIconActive : ''}`}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M16 4v18M8 14l8-10 8 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 24h24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p className={styles.dropTitle}>
            {dragOver ? 'Release to add files' : files.length > 0 ? 'Drop more files' : 'Drop files here'}
          </p>
          {files.length === 0 && (
            <p className={styles.dropSub}>or <span className={styles.browseLink}>browse your computer</span></p>
          )}
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className={styles.fileList}>
          <div className={styles.fileListHeader}>
            <span className={styles.fileCount}>{files.length} file{files.length !== 1 ? 's' : ''} ready</span>
            <button className={styles.clearAll} onClick={() => setFiles([])}>Clear all</button>
          </div>
          {files.map(file => {
            const meta = FILE_META[file.type];
            return (
              <div key={file.id} className={styles.fileItem}>
                <span className={styles.fileIconEmoji} style={{ color: meta.color }}>{meta.icon}</span>
                <span className={styles.fileName}>{file.name}</span>
                <span className={styles.fileTypePill} style={{ '--pill-color': meta.color } as React.CSSProperties}>
                  {meta.label}
                </span>
                <button
                  className={styles.removeBtn}
                  onClick={() => setFiles(prev => prev.filter(f => f.id !== file.id))}
                  aria-label={`Remove ${file.name}`}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Generation settings */}
      <div className={styles.settings}>
        <div className={styles.settingField}>
          <label className={styles.settingLabel}>Target audience</label>
          <select
            className={styles.settingSelect}
            value={audience}
            onChange={e => setAudience(e.target.value)}
          >
            <option value="">Auto-detect from content</option>
            <option value="Beginners with no prior knowledge">Beginners, no prior knowledge</option>
            <option value="Intermediate practitioners">Intermediate practitioners</option>
            <option value="Advanced professionals">Advanced professionals</option>
            <option value="Students and academics">Students & academics</option>
            <option value="Managers and executives">Managers & executives</option>
            <option value="Technical engineers">Technical engineers</option>
            <option value="Sales and customer-facing teams">Sales & customer-facing teams</option>
          </select>
        </div>
        <div className={styles.settingField}>
          <label className={styles.settingLabel}>Difficulty level</label>
          <select
            className={styles.settingSelect}
            value={level}
            onChange={e => setLevel(e.target.value)}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>

      <button
        className={styles.generateBtn}
        onClick={() => onGenerate(files, audience || 'General audience', level)}
        disabled={files.length === 0 || isGenerating}
      >
        {isGenerating ? (
          <><span className={styles.spinner} />Analyzing &amp; generating course…</>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1l1.8 5.2L15 8l-5.2 1.8L8 15l-1.8-5.2L1 8l5.2-1.8L8 1z" fill="currentColor"/>
            </svg>
            Generate Course from {files.length > 0 ? `${files.length} File${files.length !== 1 ? 's' : ''}` : 'Materials'}
          </>
        )}
      </button>
    </div>
  );
}
