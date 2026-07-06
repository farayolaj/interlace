/**
 * A typed event emitter base class used throughout the library.
 */

export type EventListener<T = any> = (event: T) => void;

export class EventEmitter<TEvents extends Record<string, any>> {
  private listeners: Map<keyof TEvents, Set<EventListener>> = new Map();

  on<K extends keyof TEvents>(
    eventName: K,
    listener: EventListener<TEvents[K]>,
  ): () => void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventName)?.delete(listener);
    };
  }

  once<K extends keyof TEvents>(
    eventName: K,
    listener: EventListener<TEvents[K]>,
  ): () => void {
    const unsubscribe = this.on(eventName, (event: TEvents[K]) => {
      unsubscribe();
      listener(event);
    });
    return unsubscribe;
  }

  emit<K extends keyof TEvents>(eventName: K, event: TEvents[K]): void {
    const eventListeners = this.listeners.get(eventName);
    if (eventListeners) {
      for (const listener of eventListeners) {
        listener(event);
      }
    }
  }

  off<K extends keyof TEvents>(
    eventName: K,
    listener: EventListener<TEvents[K]>,
  ): void {
    this.listeners.get(eventName)?.delete(listener);
  }

  removeAllListeners(eventName?: keyof TEvents): void {
    if (eventName === undefined) {
      this.listeners.clear();
    } else {
      this.listeners.delete(eventName);
    }
  }
}
