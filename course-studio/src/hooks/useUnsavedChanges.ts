import { useState, useCallback } from 'react';

export function useUnsavedChanges(initialValue: string) {
  const [savedValue, setSavedValue] = useState(initialValue);
  const [currentValue, setCurrentValue] = useState(initialValue);

  const isDirty = currentValue !== savedValue;

  const markSaved = useCallback((value: string) => {
    setSavedValue(value);
    setCurrentValue(value);
  }, []);

  const reset = useCallback((value: string) => {
    setSavedValue(value);
    setCurrentValue(value);
  }, []);

  return { currentValue, setCurrentValue, isDirty, markSaved, reset };
}
