import { Injectable } from '@angular/core'
import { CustomFieldChoice } from 'src/app/data/custom-field-choice'
import { AbstractPaperlessService } from './abstract-paperless-service'

@Injectable({ providedIn: 'root' })
export class CustomFieldChoiceService extends AbstractPaperlessService<CustomFieldChoice> {
  constructor() {
    super()
    this.resourceName = 'custom_field_choices'
  }
}
