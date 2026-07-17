'use client';

import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';

export type WidgetLayoutState = {
  order: string[];
  isEditing: boolean;
  enterEdit: () => void;
  saveLayout: () => void;
  resetLayout: () => void;
  moveWidget: (draggedId: string, targetId: string) => void;
};

/**
 * Tracks a page's widget order, persisted to localStorage under `layout:<pageKey>`.
 * Falls back to `defaultOrder` when nothing is saved, or when saved data no longer
 * matches the current set of widget ids (e.g. after a widget was added/removed).
 */
export function useWidgetLayout(pageKey: string, defaultOrder: string[]): WidgetLayoutState {
  const defaultOrderKey = defaultOrder.join('|');
  const [order, setOrder] = useState<string[]>(defaultOrder);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setIsEditing(false);
    const defaults = defaultOrderKey.split('|');
    if (typeof window === 'undefined') {
      setOrder(defaults);
      return;
    }
    try {
      const raw = window.localStorage.getItem(`layout:${pageKey}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === defaults.length && defaults.every((id) => parsed.includes(id))) {
          setOrder(parsed as string[]);
          return;
        }
      }
    } catch {
      // Malformed localStorage data — fall through to defaults.
    }
    setOrder(defaults);
  }, [pageKey, defaultOrderKey]);

  const moveWidget = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setOrder((current) => {
      const from = current.indexOf(draggedId);
      const to = current.indexOf(targetId);
      if (from === -1 || to === -1) return current;
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, draggedId);
      return next;
    });
  }, []);

  const enterEdit = useCallback(() => setIsEditing(true), []);

  const saveLayout = useCallback(() => {
    setOrder((current) => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`layout:${pageKey}`, JSON.stringify(current));
      }
      return current;
    });
    setIsEditing(false);
  }, [pageKey]);

  const resetLayout = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(`layout:${pageKey}`);
    }
    setOrder(defaultOrderKey.split('|'));
    setIsEditing(false);
  }, [defaultOrderKey, pageKey]);

  return { order, isEditing, enterEdit, saveLayout, resetLayout, moveWidget };
}

export function EditLayoutControls({ layout }: { layout: WidgetLayoutState }) {
  return (
    <div className="flex items-center justify-end gap-3">
      {layout.isEditing ? (
        <button
          type="button"
          onClick={layout.resetLayout}
          className="text-xs font-semibold text-[color:var(--muted)] underline-offset-2 transition hover:text-[color:var(--accent-strong)] hover:underline"
        >
          Reset to default
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => (layout.isEditing ? layout.saveLayout() : layout.enterEdit())}
        className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-contrast)] transition hover:bg-[color:var(--accent-strong)]"
      >
        {layout.isEditing ? 'Save Layout' : 'Edit Layout'}
      </button>
    </div>
  );
}

function DragHandleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="6" r="1.6" fill="currentColor" />
      <circle cx="15" cy="6" r="1.6" fill="currentColor" />
      <circle cx="9" cy="12" r="1.6" fill="currentColor" />
      <circle cx="15" cy="12" r="1.6" fill="currentColor" />
      <circle cx="9" cy="18" r="1.6" fill="currentColor" />
      <circle cx="15" cy="18" r="1.6" fill="currentColor" />
    </svg>
  );
}

type DraggableWidgetProps = {
  id: string;
  className?: string;
  isEditing?: boolean;
  draggingId?: string | null;
  onDragStart?: (id: string) => void;
  onDragOverWidget?: (id: string) => void;
  onDragEnd?: () => void;
  children: ReactNode;
};

export function DraggableWidget({
  id,
  className,
  isEditing,
  draggingId,
  onDragStart,
  onDragOverWidget,
  onDragEnd,
  children,
}: DraggableWidgetProps) {
  const isDragging = draggingId === id;

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isEditing) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onDragStart?.(id);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isEditing || draggingId !== id) return;
    const hovered = document
      .elementsFromPoint(event.clientX, event.clientY)
      .find((el) => {
        const widgetId = el.getAttribute('data-widget-id');
        return widgetId && widgetId !== id;
      });
    const targetId = hovered?.getAttribute('data-widget-id');
    if (targetId) onDragOverWidget?.(targetId);
  };

  const handlePointerUp = () => {
    if (!isEditing) return;
    onDragEnd?.();
  };

  return (
    <div
      data-widget-id={id}
      className={`relative grid transition-shadow duration-150 ${className ?? ''} ${
        isDragging
          ? 'z-20 scale-[1.02] opacity-90 shadow-2xl'
          : isEditing
          ? '-translate-y-0.5 shadow-[var(--shadow)]'
          : ''
      }`}
    >
      {isEditing ? (
        <button
          type="button"
          aria-label="Drag to reorder this widget"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ touchAction: 'none' }}
          className="absolute right-3 top-3 z-30 flex h-7 w-7 cursor-grab items-center justify-center rounded-full bg-[color:var(--surface-strong)] text-[color:var(--muted)] shadow-[var(--shadow-soft)] transition hover:text-[color:var(--accent-strong)] active:cursor-grabbing"
        >
          <DragHandleIcon />
        </button>
      ) : null}
      {children}
    </div>
  );
}

export function WidgetGrid({
  className,
  order,
  isEditing,
  onReorder,
  children,
}: {
  className: string;
  order: string[];
  isEditing: boolean;
  onReorder: (draggedId: string, targetId: string) => void;
  children: ReactNode;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing && draggingId) setDraggingId(null);
  }, [isEditing, draggingId]);

  useEffect(() => {
    if (!draggingId) return;
    const clearDrag = () => setDraggingId(null);
    window.addEventListener('pointerup', clearDrag);
    window.addEventListener('pointercancel', clearDrag);
    return () => {
      window.removeEventListener('pointerup', clearDrag);
      window.removeEventListener('pointercancel', clearDrag);
    };
  }, [draggingId]);

  const items = Children.toArray(children).filter(isValidElement) as ReactElement<DraggableWidgetProps>[];
  const sorted = [...items].sort((a, b) => {
    const ai = order.indexOf(a.props.id);
    const bi = order.indexOf(b.props.id);
    return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
  });

  return (
    <div className={className}>
      {sorted.map((child) =>
        cloneElement(child, {
          isEditing,
          draggingId,
          onDragStart: setDraggingId,
          onDragOverWidget: (targetId: string) => {
            if (!draggingId || draggingId === targetId) return;
            onReorder(draggingId, targetId);
          },
          onDragEnd: () => setDraggingId(null),
        } satisfies Partial<DraggableWidgetProps>)
      )}
    </div>
  );
}
