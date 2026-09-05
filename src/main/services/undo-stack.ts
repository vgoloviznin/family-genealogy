import type { UndoAction } from '@shared/types';

const MAX_UNDO = 5;

/** One user-visible undo step may reverse several mutations (e.g. create person + link). */
type UndoStep = UndoAction[];

const stack: UndoStep[] = [];
let undoDepth = 0;
let suppressUndo = 0;

export function recordUndo(...actions: UndoAction[]): void {
  if (undoDepth > 0 || suppressUndo > 0 || actions.length === 0) {
    return;
  }
  stack.push(actions);
  if (stack.length > MAX_UNDO) {
    stack.shift();
  }
}

export async function withUndoSuppressed<T>(fn: () => Promise<T> | T): Promise<T> {
  suppressUndo++;
  try {
    return await fn();
  } finally {
    suppressUndo--;
  }
}

export function canUndo(): boolean {
  return stack.length > 0;
}

export function clearUndo(): void {
  stack.length = 0;
}

export function getUndoStackLength(): number {
  return stack.length;
}

export function takeUndoStep(): UndoAction[] | null {
  const step = stack.pop();
  if (!step || step.length === 0) {
    return null;
  }
  return step;
}

export async function runWithUndoDepth<T>(fn: () => Promise<T> | T): Promise<T> {
  undoDepth++;
  try {
    return await fn();
  } finally {
    undoDepth--;
  }
}
