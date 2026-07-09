/**
 * Content type definitions and registry.
 */

export interface ContentTypePreloadDescriptor {
  /** URLs or resource identifiers to preload */
  urls?: string[];
  /** Optional timeout for preloading */
  timeoutMs?: number;
}

export interface PlaybackCallbacks {
  onComplete(score?: number): void;
}

export interface ContentType<TData = any> {
  /** Unique identifier for this content type */
  getId(): string;

  /** Current version of this content type's data format */
  getVersion(): number;

  /** Whether instances of this content type contribute to aggregation scoring */
  isScorable(): boolean;

  /**
   * If isScorable returns true, returns the total score available for this content.
   */
  getTotalScore?(data: TData): number;

  /**
   * If isScorable returns true, computes the result score for this content instance.
   */
  getResultScore?(): number;

  /**
   * Optional hook describing assets to preload for this content.
   */
  preload?(): ContentTypePreloadDescriptor | Promise<void>;

  /**
   * Called by the editor to render this content type's own editing interface.
   * The content type is responsible for rendering into the provided container element.
   */
  renderEditor(
    container: HTMLElement,
    data: TData,
    onChange: (newData: TData) => void,
  ): void;

  /**
   * Called by the editor to rerender this content type's editing interface when the data changes.
   * The content type is responsible for updating the editor UI to reflect the new data, while keeping internal state intact.
   * If not implemented, the editor will be unmounted and remounted instead, which may cause loss of internal state.
   */
  updateEditor?(
    container: HTMLElement,
    data: TData,
    onChange: (newData: TData) => void,
  ): void;

  /**
   * Called by the editor when this content's editing session ends or switches to another content.
   * The content type must clean up any subscriptions, timers, or other resources.
   */
  unmount?(container: HTMLElement): void;

  /**
   * Called by the player to render this content type's playback interface.
   * The content type is responsible for rendering into the provided container element.
   */
  renderPlayback(
    container: HTMLElement,
    data: TData,
    callbacks: PlaybackCallbacks,
  ): void;

  /**
   * Called by the player when this content's playback session ends or switches to another content.
   * The content type must clean up any subscriptions, timers, or other resources.
   */
  unmountPlayback?(container: HTMLElement): void;

  /**
   * Optional migration function to upgrade data from an older version.
   */
  migrate?(oldData: any, fromVersion: number): TData;
}

export class ContentTypeRegistry {
  private registry: Map<string, ContentType> = new Map();

  register(contentType: ContentType): void {
    if (this.registry.has(contentType.getId())) {
      throw new Error(
        `Content type with id "${contentType.getId()}" is already registered`,
      );
    }
    this.registry.set(contentType.getId(), contentType);
  }

  get(id: string): ContentType | undefined {
    return this.registry.get(id);
  }

  has(id: string): boolean {
    return this.registry.has(id);
  }

  getAll(): ContentType[] {
    return Array.from(this.registry.values());
  }
}
