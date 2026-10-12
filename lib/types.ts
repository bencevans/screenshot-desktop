import type { Buffer } from 'buffer'

/**
 * Capture settings shared by the platform implementations.
 * Supported formats and display IDs depend on the operating system.
 */
export interface ScreenshotOptions {
  /**
   * Save to an absolute or relative path and return its absolute path.
   * Omitting this option, or supplying an empty string, returns image bytes.
   */
  filename?: string
  /**
   * Image encoding. JPG is the default; Linux can infer PNG from the filename.
   */
  format?: string
  /**
   * Display ID from listDisplays(); omit to capture the platform default.
   */
  screen?: string | number
  /**
   * Linux capture tool. scrot captures the whole desktop without display selection.
   */
  linuxLibrary?: 'scrot' | 'imagemagick'
}

/**
 * Shared display metadata. Optional fields are populated by individual platforms.
 */
export interface Display {
  id: string | number
  name: string
  primary?: boolean
  width?: number
  height?: number
  offsetX?: number
  offsetY?: number
  crop?: string
  top?: number
  right?: number
  bottom?: number
  left?: number
  dpiScale?: number
}

/**
 * macOS display metadata; IDs are zero-based, with the primary display first.
 */
export interface DarwinDisplay extends Display {
  id: number
  primary: boolean
}

/**
 * Active X11 output, including geometry for ImageMagick crop arguments.
 */
export interface LinuxDisplay extends Display {
  id: string
  width: number
  height: number
  offsetX: number
  offsetY: number
  primary: boolean
  crop: string
}

/**
 * Windows display identifier, desktop bounds and DPI scale reported by the helper.
 */
export interface WindowsDisplay extends Display {
  id: string
  top: number
  right: number
  bottom: number
  left: number
  dpiScale: number
  height: number
  width: number
}

/**
 * Callable capture API with platform-specific display discovery.
 * Capture resolves to image bytes or an absolute filename, depending on options.
 * Capture and discovery failures reject their promises.
 */
export interface Screenshot<D extends Display = Display> {
  /**
   * An empty filename requests an in-memory image.
   */
  (options: ScreenshotOptions & { filename: '' }): Promise<Buffer>
  /**
   * A nonempty filename saves the image; a possibly empty string may return bytes.
   */
  <const F extends string>(
    options: Omit<ScreenshotOptions, 'filename'> & { filename: F }
  ): Promise<F extends '' ? Buffer : string extends F ? Buffer | string : string>
  /**
   * Capture to an in-memory image when no filename is supplied.
   */
  (options?: ScreenshotOptions & { filename?: undefined }): Promise<Buffer>
  /**
   * Capture with dynamically constructed options.
   */
  (options: ScreenshotOptions): Promise<Buffer | string>
  /**
   * List detected displays in the platform's capture order.
   * Some macOS VMs return an empty list despite supporting default capture.
   */
  listDisplays(): Promise<D[]>
  /**
   * Capture detected displays as JPG buffers in discovery order.
   * macOS falls back to the default display when discovery returns no metadata.
   */
  all(): Promise<Buffer[]>
  /** The legacy alias is available on Windows only. */
  availableDisplays?: () => Promise<D[]>
  /**
   * Legacy platform parser exposed for integrations that already consume tool output.
   */
  parseDisplaysOutput?: (output: string) => D[]
  /**
   * Sample native discovery output retained for parser integrations and tests.
   */
  EXAMPLE_DISPLAYS_OUTPUT?: string
}
