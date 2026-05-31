import { desktopCapturer, dialog } from 'electron'
import { createWorker } from 'tesseract.js'
import type { Worker } from 'tesseract.js'
import { ServiceBase } from './ServiceBase'
import type { OCRResult, ScreenCaptureData, ScreenCaptureOptions } from './types'

export class ScreenCaptureService extends ServiceBase {
  private ocrWorker: Worker | null = null
  private ocrReady = false

  constructor() {
    super({
      name: 'screen_capture',
      version: '1.0.0',
      description: 'Screen & window capture with OCR',
    })
  }

  async init(): Promise<void> {
    this.setReady()
  }

  async shutdown(): Promise<void> {
    if (this.ocrWorker) {
      await this.ocrWorker.terminate()
      this.ocrWorker = null
    }
    this.ocrReady = false
    this.ready = false
  }

  isOCRReady(): boolean {
    return this.ocrReady
  }

  private async ensureOCRWorker(): Promise<Worker> {
    if (this.ocrWorker) return this.ocrWorker
    this.ocrWorker = await createWorker('eng+chi_sim')
    this.ocrReady = true
    return this.ocrWorker
  }

  private async confirmPermission(action: string): Promise<boolean> {
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['拒绝', '允许'],
      defaultId: 0,
      cancelId: 0,
      title: `${action} - 隐私确认`,
      message: `Friday 想要捕获${action === '捕获屏幕' ? '屏幕' : '窗口'}内容`,
      detail: '捕获的图像仅用于本次处理，不会被永久保存或分享到外部。',
    })
    return response === 1
  }

  async captureScreen(): Promise<Buffer> {
    if (!await this.confirmPermission('捕获屏幕')) {
      throw new Error('PERMISSION_DENIED: 用户拒绝了屏幕捕获请求')
    }
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    if (sources.length === 0) throw new Error('未找到可捕获的屏幕')
    return sources[0].thumbnail.toPNG()
  }

  async captureWindow(windowName?: string): Promise<Buffer> {
    if (!await this.confirmPermission('捕获窗口')) {
      throw new Error('PERMISSION_DENIED: 用户拒绝了窗口捕获请求')
    }
    const sources = await desktopCapturer.getSources({ types: ['window'] })
    let source
    if (windowName) {
      source = sources.find(s => s.name.toLowerCase().includes(windowName.toLowerCase()))
      if (!source) throw new Error(`未找到匹配的窗口: ${windowName}`)
    } else {
      source = sources.find(s => !s.name.includes('Friday') && !s.name.includes('Electron')) || sources[0]
    }
    return source.thumbnail.toPNG()
  }

  async performOCR(image: Buffer): Promise<OCRResult> {
    const worker = await this.ensureOCRWorker()
    const { data } = await worker.recognize(image)
    const words: OCRResult['words'] = []
    if (data.blocks) {
      for (const block of data.blocks) {
        for (const para of block.paragraphs) {
          for (const line of para.lines) {
            for (const w of line.words) {
              words.push({
                text: w.text,
                confidence: w.confidence,
                bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 },
              })
            }
          }
        }
      }
    }
    return { text: data.text, confidence: data.confidence, words }
  }

  async captureAll(options?: ScreenCaptureOptions): Promise<ScreenCaptureData> {
    const isWindow = !!options?.windowName
    const image = isWindow ? await this.captureWindow(options!.windowName) : await this.captureScreen()
    const ocr = options?.ocr !== false ? await this.performOCR(image) : null
    return {
      image: image.toString('base64'),
      sourceName: isWindow ? options!.windowName! : '全屏',
      sourceType: isWindow ? 'window' : 'screen',
      ocr,
    }
  }
}
