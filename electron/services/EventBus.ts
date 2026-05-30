import { EventEmitter } from 'events'

export type EventListener = (event: string, data: unknown) => void

export class AppEventBus extends EventEmitter {
  private static instance: AppEventBus

  static getInstance(): AppEventBus {
    if (!AppEventBus.instance) {
      AppEventBus.instance = new AppEventBus()
    }
    return AppEventBus.instance
  }

  emitEvent(event: string, data: unknown): void {
    this.emit('kernel:event', event, data)
  }

  onEvent(listener: EventListener): () => void {
    this.on('kernel:event', listener)
    return () => this.off('kernel:event', listener)
  }
}
