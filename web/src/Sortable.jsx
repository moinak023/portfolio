import React from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from './ui.jsx';

const onlyUpDown = ({ transform }) => ({ ...transform, x: 0 });
const keyHelp = { draggable: 'Drag the handle to move this item. With the keyboard, press the up or down arrow key to move it one place.' };

/**
 * A list whose rows can be put in a new order by their grip handle: drag it with a mouse or a finger, or focus it
 * and press the up or down arrow key to move the row one place.
 * renderRow(item, index, grip) returns the row; put {grip} where the handle should appear.
 */
export function SortableList({ items, getId = (x) => x.id, onReorder, renderRow, label = 'Drag to reorder' }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const ids = items.map((x, i) => String(getId(x) || `row-${i}`));
  const move = (from, to) => { if (to >= 0 && to < items.length && from !== to) onReorder(arrayMove(items, from, to), from, to); };
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    move(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[onlyUpDown]} accessibility={{ screenReaderInstructions: keyHelp }}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((x, i) => <Row key={ids[i]} id={ids[i]} label={label} onStep={(dir) => move(i, i + dir)}>{(grip) => renderRow(x, i, grip)}</Row>)}
      </SortableContext>
    </DndContext>
  );
}

function Row({ id, label, onStep, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, position: 'relative', zIndex: isDragging ? 5 : undefined };
  const onKeyDown = (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    onStep(e.key === 'ArrowUp' ? -1 : 1);
  };
  const grip = (
    <button type="button" className="a-grip" ref={setActivatorNodeRef} {...attributes} {...listeners} onKeyDown={onKeyDown} aria-label={label} title={label} data-grip="">
      <Icon name="grip" size={18} />
    </button>
  );
  return <div ref={setNodeRef} style={style} className={isDragging ? 'a-dragging' : undefined} data-sortable="">{children(grip)}</div>;
}
