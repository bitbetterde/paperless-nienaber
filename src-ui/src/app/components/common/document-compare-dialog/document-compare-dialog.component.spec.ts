import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { By } from '@angular/platform-browser'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { allIcons, NgxBootstrapIconsModule } from 'ngx-bootstrap-icons'
import { of, throwError } from 'rxjs'
import { Document } from 'src/app/data/document'
import { SETTINGS_KEYS } from 'src/app/data/ui-settings'
import { DocumentService } from 'src/app/services/rest/document.service'
import { SettingsService } from 'src/app/services/settings.service'
import { PngxPdfViewerComponent } from '../pdf-viewer/pdf-viewer.component'
import { PdfZoomLevel, PdfZoomScale } from '../pdf-viewer/pdf-viewer.types'
import { DocumentCompareDialogComponent } from './document-compare-dialog.component'

const docs: Document[] = [
  {
    id: 47,
    title: 'Rechnung 47',
    archived_file_name: 'rechnung.pdf',
    mime_type: 'application/pdf',
  },
  {
    id: 22,
    title: 'Lieferschein 22',
    mime_type: 'image/png',
  },
]

describe('DocumentCompareDialogComponent', () => {
  let component: DocumentCompareDialogComponent
  let fixture: ComponentFixture<DocumentCompareDialogComponent>
  let documentService: DocumentService
  let settingsService: SettingsService
  let activeModal: NgbActiveModal

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        DocumentCompareDialogComponent,
        NgxBootstrapIconsModule.pick(allIcons),
      ],
      providers: [
        NgbActiveModal,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    })
    documentService = TestBed.inject(DocumentService)
    settingsService = TestBed.inject(SettingsService)
    activeModal = TestBed.inject(NgbActiveModal)
    settingsService.set(SETTINGS_KEYS.USE_NATIVE_PDF_VIEWER, false)
    jest
      .spyOn(documentService, 'getPreviewUrl')
      .mockImplementation((id) => `preview/${id}`)
    fixture = TestBed.createComponent(DocumentCompareDialogComponent)
    component = fixture.componentInstance
  })

  it('should load both documents', () => {
    const getSpy = jest
      .spyOn(documentService, 'get')
      .mockImplementation((id) => of(docs.find((d) => d.id === id)))
    component.setIds([47, 22])
    fixture.detectChanges()
    expect(getSpy).toHaveBeenCalledTimes(2)
    expect(component.sides().map((s) => s.id)).toEqual([47, 22])
    expect(component.sides()[1].previewUrl).toEqual('preview/22')
    expect(fixture.nativeElement.textContent).toContain('Rechnung 47')
    expect(fixture.nativeElement.textContent).toContain('Lieferschein 22')
  })

  it('should render pdf viewer for pdfs and object otherwise', () => {
    jest
      .spyOn(documentService, 'get')
      .mockImplementation((id) => of(docs.find((d) => d.id === id)))
    component.setIds([47, 22])
    fixture.detectChanges()
    expect(
      fixture.debugElement.queryAll(By.directive(PngxPdfViewerComponent))
    ).toHaveLength(1)
    expect(fixture.debugElement.queryAll(By.css('object'))).toHaveLength(1)
  })

  it('should render objects if native PDF viewer enabled', () => {
    settingsService.set(SETTINGS_KEYS.USE_NATIVE_PDF_VIEWER, true)
    jest
      .spyOn(documentService, 'get')
      .mockImplementation((id) => of(docs.find((d) => d.id === id)))
    component.setIds([47, 22])
    fixture.detectChanges()
    expect(fixture.debugElement.queryAll(By.css('object'))).toHaveLength(2)
  })

  it('should show an error on one side without affecting the other', () => {
    jest
      .spyOn(documentService, 'get')
      .mockImplementation((id) =>
        id === 22
          ? throwError(() => new Error('not found'))
          : of(docs.find((d) => d.id === id))
      )
    component.setIds([47, 22])
    fixture.detectChanges()
    expect(component.sides()[0].error).toBeFalsy()
    expect(component.sides()[1].error).toBeTruthy()
    expect(fixture.nativeElement.textContent).toContain(
      'Error loading document'
    )
    expect(fixture.nativeElement.textContent).toContain('Rechnung 47')
  })

  it('should close the modal', () => {
    const closeSpy = jest.spyOn(activeModal, 'close')
    fixture.detectChanges()
    fixture.debugElement.query(By.css('.btn-close')).nativeElement.click()
    expect(closeSpy).toHaveBeenCalled()
  })

  it('should zoom each side separately', () => {
    settingsService.set(
      SETTINGS_KEYS.PDF_VIEWER_ZOOM_SETTING,
      PdfZoomScale.PageWidth
    )
    jest
      .spyOn(documentService, 'get')
      .mockImplementation((id) => of(docs.find((d) => d.id === id)))
    component.setIds([47, 22])
    fixture.detectChanges()
    expect(component.sides()[0].zoom).toEqual(PdfZoomLevel.One)
    expect(component.sides()[0].zoomScale).toEqual(PdfZoomScale.PageWidth)

    component.increaseZoom(0)
    expect(component.sides()[0].zoom).toEqual(PdfZoomLevel.OneAndHalf)
    expect(component.sides()[1].zoom).toEqual(PdfZoomLevel.One)

    component.decreaseZoom(0)
    component.decreaseZoom(0)
    expect(component.sides()[0].zoom).toEqual(PdfZoomLevel.ThreeQuarters)

    component.setZoom(1, PdfZoomScale.PageFit)
    expect(component.currentZoom(component.sides()[1])).toEqual(
      PdfZoomScale.PageFit
    )
    component.increaseZoom(1)
    expect(component.sides()[1].zoomScale).toEqual(PdfZoomScale.PageWidth)
    expect(component.sides()[1].zoom).toEqual(PdfZoomLevel.OneAndHalf)
    expect(component.getZoomSettingTitle(PdfZoomLevel.Half)).toEqual('50%')
  })

  it('should show zoom controls only for sides rendered by the pdf viewer', () => {
    jest
      .spyOn(documentService, 'get')
      .mockImplementation((id) => of(docs.find((d) => d.id === id)))
    component.setIds([47, 22])
    fixture.detectChanges()
    expect(
      fixture.debugElement.queryAll(By.css('.modal-header select'))
    ).toHaveLength(1)
    const select = fixture.debugElement.query(
      By.css('.modal-header select')
    ).nativeElement
    select.value = PdfZoomLevel.Two
    select.dispatchEvent(new Event('change'))
    expect(component.sides()[0].zoom).toEqual(PdfZoomLevel.Two)
  })
})
