import { HttpTestingController } from '@angular/common/http/testing'
import { Subscription } from 'rxjs'
import { commonAbstractPaperlessServiceTests } from './abstract-paperless-service.spec'
import { CustomFieldChoiceService } from './custom-field-choice.service'

let httpTestingController: HttpTestingController
let service: CustomFieldChoiceService
let subscription: Subscription
const endpoint = 'custom_field_choices'

commonAbstractPaperlessServiceTests(endpoint, CustomFieldChoiceService)
