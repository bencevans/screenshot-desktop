import type { Buffer } from 'buffer'

export interface ScreenshotOptions {
  filename?: string
  format?: string
  screen?: string | number
  linuxLibrary?: 'scrot' | 'imagemagick'
}

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

export interface DarwinDisplay extends Display {
  id: number
  primary: boolean
}

export interface LinuxDisplay extends Display {
  id: string
  width: number
  height: number
  offsetX: number
  offsetY: number
  primary: boolean
  crop: string
}

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

export interface Screenshot<D extends Display = Display> {
  (options: ScreenshotOptions & { filename: '' }): Promise<Buffer>
  (options: ScreenshotOptions & { filename: string }): Promise<string>
  (options?: ScreenshotOptions & { filename?: undefined }): Promise<Buffer>
  (options: ScreenshotOptions): Promise<Buffer | string>
  listDisplays(): Promise<D[]>
  all(): Promise<Buffer[]>
  /** The legacy alias is available on Windows only. */
  availableDisplays?: () => Promise<D[]>
  parseDisplaysOutput?: (output: string) => D[]
  EXAMPLE_DISPLAYS_OUTPUT?: string
}
