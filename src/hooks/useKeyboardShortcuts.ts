import { useEffect } from 'react';

interface KeyboardShortcutsConfig {
  onFocusComposer?: () => void;
  onToggleModels?: () => void;
  onEscape?: () => void;
}

export const useKeyboardShortcuts = ({
  onFocusComposer,
  onToggleModels,
  onEscape,
}: KeyboardShortcutsConfig) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl+K - Focus composer
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        onFocusComposer?.();
        return;
      }

      // Cmd/Ctrl+Shift+M - Toggle models drawer (mobile)
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'M') {
        event.preventDefault();
        onToggleModels?.();
        return;
      }

      // Escape - Close drawers/banners
      if (event.key === 'Escape') {
        onEscape?.();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onFocusComposer, onToggleModels, onEscape]);
};