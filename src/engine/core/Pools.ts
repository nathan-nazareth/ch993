// Pools.ts — fixed-size object pool for short-lived objects (arrows,
// particles). CPU-friendly: avoids GC pressure in the per-frame loop.

export class Pool<T> {
  private free: T[] = [];
  private inUse = new Set<T>();
  private factory: () => T;
  private reset: (item: T) => void;

  constructor(factory: () => T, reset: (item: T) => void, size: number) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < size; i++) {
      this.free.push(factory());
    }
  }

  acquire(): T | null {
    if (this.free.length === 0) return null;
    const item = this.free.pop()!;
    this.inUse.add(item);
    return item;
  }

  release(item: T): void {
    if (!this.inUse.has(item)) return;
    this.inUse.delete(item);
    this.reset(item);
    this.free.push(item);
  }

  releaseAll(): void {
    for (const item of this.inUse) {
      this.reset(item);
      this.free.push(item);
    }
    this.inUse.clear();
  }

  get activeCount(): number { return this.inUse.size; }
  get freeCount(): number { return this.free.length; }
}
