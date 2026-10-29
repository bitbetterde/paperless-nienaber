import { Component, DestroyRef, inject, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { Document } from 'src/app/data/document'
import { SETTINGS_KEYS } from 'src/app/data/ui-settings'
import { DocumentTitlePipe } from 'src/app/pipes/document-title.pipe'
import { SafeUrlPipe } from 'src/app/pipes/safeurl.pipe'
import { DocumentService } from 'src/app/services/rest/document.service'
import { SettingsService } from 'src/app/services/settings.service'
import { PngxPdfViewerComponent } from '../pdf-viewer/pdf-viewer.component'
import {
  PdfRenderMode,
  PdfZoomLevel,
  PdfZoomScale,
} from '../pdf-viewer/pdf-viewer.types'

export interface CompareSide {
  id: number
  previewUrl: string
  zoom: PdfZoomLevel
  zoomScale: PdfZoomScale
  document?: Document
  error?: boolean
}

@Component({
  selector: 'pngx-document-compare-dialog',
  templateUrl: './document-compare-dialog.component.html',
  styleUrls: ['./document-compare-dialog.component.scss'],
  imports: [PngxPdfViewerComponent, DocumentTitlePipe, SafeUrlPipe],
})
export class DocumentCompareDialogComponent {
  PdfRenderMode = PdfRenderMode

  activeModal = inject(NgbActiveModal)
  private readonly documentService = inject(DocumentService)
  private readonly settingsService = inject(SettingsService)
  private readonly destroyRef = inject(DestroyRef)

  readonly sides = signal<CompareSide[]>([])

  get useNativePdfViewer(): boolean {
    return this.settingsService.get(SETTINGS_KEYS.USE_NATIVE_PDF_VIEWER)
  }

  public setIds(ids: number[]): void {
    const zoom = this.zoomFor(
      this.settingsService.get(
        SETTINGS_KEYS.PDF_VIEWER_ZOOM_SETTING
      ) as PdfZoomScale
    )
    this.sides.set(
      ids.map((id) => ({
        id,
        previewUrl: this.documentService.getPreviewUrl(id),
        ...zoom,
      }))
    )
    ids.forEach((id, index) =>
      this.documentService
        .get(id, null, 'id,title,mime_type,archived_file_name')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (document) => this.updateSide(index, { document }),
          error: () => this.updateSide(index, { error: true }),
        })
    )
  }

  updateSide(index: number, changes: Partial<CompareSide>) {
    this.sides.update((sides) =>
      sides.map((side, i) => (i === index ? { ...side, ...changes } : side))
    )
  }

  renderAsPdfViewer(document: Document): boolean {
    const isPdf =
      document.archived_file_name?.length > 0 ||
      document.mime_type?.includes('pdf')
    return isPdf && !this.useNativePdfViewer
  }

  // zoom handling as in DocumentDetailComponent, but per side
  private zoomFor(
    setting: PdfZoomScale | PdfZoomLevel
  ): Pick<CompareSide, 'zoom' | 'zoomScale'> {
    if (
      setting === PdfZoomScale.PageFit ||
      setting === PdfZoomScale.PageWidth
    ) {
      return { zoomScale: setting, zoom: PdfZoomLevel.One }
    }
    return { zoomScale: PdfZoomScale.PageWidth, zoom: setting }
  }

  setZoom(index: number, setting: PdfZoomScale | PdfZoomLevel) {
    this.updateSide(index, this.zoomFor(setting))
  }

  get zoomSettings() {
    return [PdfZoomScale.PageFit, ...Object.values(PdfZoomLevel)]
  }

  currentZoom(side: CompareSide) {
    if (side.zoomScale === PdfZoomScale.PageFit) {
      return PdfZoomScale.PageFit
    }
    return side.zoom
  }

  getZoomSettingTitle(setting: PdfZoomScale | PdfZoomLevel): string {
    switch (setting) {
      case PdfZoomScale.PageFit:
        return $localize`Page Fit`
      default:
        return `${parseFloat(setting) * 100}%`
    }
  }

  increaseZoom(index: number): void {
    const side = this.sides()[index]
    const zoomLevels = Object.values(PdfZoomLevel)
    let currentIndex = zoomLevels.indexOf(side.zoom)
    if (side.zoomScale === PdfZoomScale.PageFit) {
      currentIndex = zoomLevels.indexOf(PdfZoomLevel.One)
    }
    this.setZoom(
      index,
      zoomLevels[Math.min(zoomLevels.length - 1, currentIndex + 1)]
    )
  }

  decreaseZoom(index: number): void {
    const side = this.sides()[index]
    const zoomLevels = Object.values(PdfZoomLevel)
    let currentIndex = zoomLevels.indexOf(side.zoom)
    if (side.zoomScale === PdfZoomScale.PageFit) {
      currentIndex = zoomLevels.indexOf(PdfZoomLevel.ThreeQuarters)
    }
    this.setZoom(index, zoomLevels[Math.max(0, currentIndex - 1)])
  }

  public close(): void {
    this.activeModal.close()
  }
}
