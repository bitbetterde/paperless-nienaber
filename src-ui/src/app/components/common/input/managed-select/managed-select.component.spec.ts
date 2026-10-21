import { provideHttpClient } from '@angular/common/http'
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { By } from '@angular/platform-browser'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { SelectComponent } from '../select/select.component'
import { ManagedSelectComponent } from './managed-select.component'

describe('ManagedSelectComponent', () => {
  let fixture: ComponentFixture<ManagedSelectComponent>
  let component: ManagedSelectComponent
  let http: HttpTestingController

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagedSelectComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), NgbModal],
    }).compileComponents()
    fixture = TestBed.createComponent(ManagedSelectComponent)
    component = fixture.componentInstance
    http = TestBed.inject(HttpTestingController)
  })

  afterEach(() => http.verify())

  it('loads only choices belonging to the selected custom field', () => {
    component.customField = {
      id: 42,
      name: 'Customer',
      data_type: 'managed_select' as any,
    }

    const request = http.expectOne(
      (req) =>
        req.url.endsWith('/custom_field_choices/') &&
        req.params.get('custom_field') === '42'
    )
    request.flush({
      count: 1,
      all: [7],
      results: [{ id: 7, custom_field: 42, name: 'ACME' }],
    })

    expect(component.choices).toEqual([
      expect.objectContaining({ id: 7, custom_field: 42, name: 'ACME' }),
    ])
  })

  it('shows the assigned choice once choices have loaded, not "Private"', async () => {
    fixture.autoDetectChanges()
    component.writeValue(7)
    component.customField = {
      id: 42,
      name: 'Customer',
      data_type: 'managed_select' as any,
    }
    await fixture.whenStable()

    http
      .expectOne((req) => req.url.endsWith('/custom_field_choices/'))
      .flush({
        count: 1,
        all: [7],
        results: [{ id: 7, custom_field: 42, name: 'ACME' }],
      })
    await fixture.whenStable()

    const select: SelectComponent = fixture.debugElement.query(
      By.directive(SelectComponent)
    ).componentInstance
    expect(select.items).toEqual([
      expect.objectContaining({ id: 7, name: 'ACME' }),
    ])
    expect(select.isPrivate).toBeFalsy()
  })
})
