export function migrate<T>(data: any, type: 'course' | 'settings'): T {
  let d = { ...data };

  if (type === 'course') {
    if (!d.schemaVersion) d.schemaVersion = 1;
    if (d.projectId === undefined) d.projectId = null;
    if (!d.tags) d.tags = [];
    if (d.published === undefined) d.published = false;
    // Future: if (d.schemaVersion === 1) { ... d.schemaVersion = 2; }
  }

  if (type === 'settings') {
    if (!d.schemaVersion) d.schemaVersion = 1;
  }

  return d as T;
}
