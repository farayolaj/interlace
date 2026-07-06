/**
 * Content type definitions and registry.
 */

export interface ContentTypePreloadDescriptor {
  /** URLs or resource identifiers to preload */
  urls?: string[];
  /** Optional timeout for preloading */
  timeoutMs?: number;
}

export interface ContentType<TData = any> {
  /** Unique identifier for this content type */
  id: string;

  /** Current version of this content type's data format */
  version: number;

  /** Whether instances of this content type contribute to aggregation scoring */
  isScorable: boolean;

  /**
   * If isScorable is true, returns the total score available for this content.
   */
  getTotalScore?(data: TData): number;

  /**
   * If isScorable is true, computes the result score for this content instance.
   */
  getResultScore?(data: TData): number;

  /**
   * Optional hook describing assets to preload for this content.
   */
  preload?(data: TData): ContentTypePreloadDescriptor | Promise<void>;

  /**
   * Called by the editing UI to render this content type's own editing interface.
   * The content type is responsible for rendering into the provided container element.
   */
  renderEditor?(
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
   * Optional migration function to upgrade data from an older version.
   */
  migrate?(oldData: any, fromVersion: number): TData;
}

export class ContentTypeRegistry {
  private registry: Map<string, ContentType> = new Map();

  register(contentType: ContentType): void {
    if (this.registry.has(contentType.id)) {
      throw new Error(
        `Content type with id "${contentType.id}" is already registered`,
      );
    }
    this.registry.set(contentType.id, contentType);
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
