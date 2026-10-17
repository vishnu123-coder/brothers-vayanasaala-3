import { useSyncExternalStore } from 'react';

// Subscribes a component to one of the live stores in db.js.
export function useStore(store) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
