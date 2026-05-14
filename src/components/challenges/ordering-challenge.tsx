"use client";

import { cn } from "@/lib/utils";
import { GripVertical, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface OrderingChallengeProps {
  items: string[];
  value: number[];
  onChange: (value: number[]) => void;
  disabled?: boolean;
  hints?: string[];
  className?: string;
}

function SortableItem({
  id,
  itemIndex,
  position,
  text,
  disabled,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  id: number;
  itemIndex: number;
  position: number;
  text: string;
  disabled: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-white/[0.03] p-3 transition-all",
        isDragging
          ? "z-50 border-emerald-500/40 bg-emerald-500/[0.08] shadow-lg shadow-emerald-500/10 scale-[1.02]"
          : "border-white/5 hover:bg-white/[0.06]"
      )}
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
        {position + 1}
      </div>
      <div
        {...(!disabled ? { ...attributes, ...listeners } : {})}
        className={cn(
          "flex items-center gap-2 flex-1",
          !disabled && "cursor-grab active:cursor-grabbing"
        )}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm select-none">{text}</span>
      </div>
      {!disabled && (
        <div className="flex gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={onMoveUp}
            disabled={isFirst}
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={onMoveDown}
            disabled={isLast}
          >
            ↓
          </Button>
        </div>
      )}
    </div>
  );
}

export function OrderingChallenge({
  items,
  value,
  onChange,
  disabled = false,
  hints,
  className,
}: OrderingChallengeProps) {
  const [showHints, setShowHints] = useState(false);
  const order = value.length > 0 ? value : items.map((_, i) => i);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const moveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const newOrder = [...order];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      onChange(newOrder);
    },
    [order, onChange]
  );

  const moveDown = useCallback(
    (index: number) => {
      if (index === order.length - 1) return;
      const newOrder = [...order];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      onChange(newOrder);
    },
    [order, onChange]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = order.indexOf(active.id as number);
      const newIndex = order.indexOf(over.id as number);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(order, oldIndex, newIndex);
      onChange(newOrder);
    },
    [order, onChange]
  );

  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-sm text-muted-foreground mb-2">
        Перетащите элементы мышкой или используйте кнопки ↑↓, чтобы расставить их в правильном порядке:
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={order}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {order.map((itemIndex, position) => (
              <SortableItem
                key={itemIndex}
                id={itemIndex}
                itemIndex={itemIndex}
                position={position}
                text={items[itemIndex]}
                disabled={disabled}
                isFirst={position === 0}
                isLast={position === order.length - 1}
                onMoveUp={() => moveUp(position)}
                onMoveDown={() => moveDown(position)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {hints && hints.length > 0 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="text-amber-400 hover:text-amber-300"
            onClick={() => setShowHints(!showHints)}
          >
            <Lightbulb className="mr-1 h-3.5 w-3.5" />
            Подсказка
          </Button>

          {showHints && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-xs text-amber-400 mb-2 font-medium">Подсказки:</p>
              <ul className="space-y-1">
                {hints.map((hint, i) => (
                  <li key={i} className="text-sm text-muted-foreground">
                    • {hint}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
