import { useCallback, useMemo, useRef, useState } from 'react';

export type BulkSelectionHeaderState = {
  checked: boolean;
  indeterminate: boolean;
};

export type UseBulkSelectionOptions = {
  /** Current list item ids in render order (e.g. after filtering/sorting). */
  itemIds: string[];
};

export function useBulkSelection(options: UseBulkSelectionOptions) {
  const { itemIds } = options;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const anchorIndexRef = useRef<number | null>(null);

  const itemIndexById = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < itemIds.length; i++) {
      map.set(itemIds[i], i);
    }
    return map;
  }, [itemIds]);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
    anchorIndexRef.current = null;
  }, []);

  const isSelected = useCallback(
    (id: string) => {
      return selectedIds.has(id);
    },
    [selectedIds]
  );

  const toggle = useCallback(
    (id: string, nextSelected?: boolean) => {
      setSelectedIds(prev => {
        const next = new Set(prev);
        const shouldSelect = typeof nextSelected === 'boolean' ? nextSelected : !next.has(id);
        if (shouldSelect) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });
      const idx = itemIndexById.get(id);
      if (typeof idx === 'number') {
        anchorIndexRef.current = idx;
      }
    },
    [itemIndexById]
  );

  const selectAllVisible = useCallback(
    (nextSelected: boolean) => {
      if (!nextSelected) {
        clear();
        return;
      }
      setSelectedIds(new Set(itemIds));
      anchorIndexRef.current = itemIds.length > 0 ? 0 : null;
    },
    [clear, itemIds]
  );

  const selectByIds = useCallback(
    (ids: string[]) => {
      const visibleSet = new Set(itemIds);
      const next = ids.filter(id => visibleSet.has(id));
      setSelectedIds(new Set(next));
      const firstId = next[0];
      anchorIndexRef.current = firstId ? (itemIndexById.get(firstId) ?? null) : null;
    },
    [itemIds, itemIndexById]
  );

  const toggleWithRange = useCallback(
    (id: string, opts?: { shiftKey?: boolean }) => {
      const shiftKey = Boolean(opts?.shiftKey);
      const clickedIndex = itemIndexById.get(id);
      if (!shiftKey || typeof clickedIndex !== 'number') {
        toggle(id);
        return;
      }

      const anchorIndex = anchorIndexRef.current;
      if (typeof anchorIndex !== 'number') {
        toggle(id);
        return;
      }

      const start = Math.min(anchorIndex, clickedIndex);
      const end = Math.max(anchorIndex, clickedIndex);
      const rangeIds = itemIds.slice(start, end + 1);

      setSelectedIds(prev => {
        const next = new Set(prev);
        const shouldSelectAll = rangeIds.some(rid => !next.has(rid));
        for (const rid of rangeIds) {
          if (shouldSelectAll) next.add(rid);
          else next.delete(rid);
        }
        return next;
      });
    },
    [itemIds, itemIndexById, toggle]
  );

  const headerState: BulkSelectionHeaderState = useMemo(() => {
    if (itemIds.length === 0) {
      return { checked: false, indeterminate: false };
    }
    let selectedVisibleCount = 0;
    for (const id of itemIds) {
      if (selectedIds.has(id)) selectedVisibleCount++;
    }
    return {
      checked: selectedVisibleCount > 0 && selectedVisibleCount === itemIds.length,
      indeterminate: selectedVisibleCount > 0 && selectedVisibleCount < itemIds.length,
    };
  }, [itemIds, selectedIds]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelectionMode: selectedIds.size > 0,
    headerState,
    isSelected,
    toggle,
    toggleWithRange,
    selectAllVisible,
    selectByIds,
    clear,
  };
}
