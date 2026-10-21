import { Component, inject } from '@angular/core'
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms'
import { CustomFieldChoice } from 'src/app/data/custom-field-choice'
import { DEFAULT_MATCHING_ALGORITHM } from 'src/app/data/matching-model'
import { IfOwnerDirective } from 'src/app/directives/if-owner.directive'
import { CustomFieldChoiceService } from 'src/app/services/rest/custom-field-choice.service'
import { UserService } from 'src/app/services/rest/user.service'
import { SettingsService } from 'src/app/services/settings.service'
import { CheckComponent } from '../../input/check/check.component'
import { PermissionsFormComponent } from '../../input/permissions/permissions-form/permissions-form.component'
import { SelectComponent } from '../../input/select/select.component'
import { TextComponent } from '../../input/text/text.component'
import { EditDialogComponent } from '../edit-dialog.component'

@Component({
  selector: 'pngx-custom-field-choice-edit-dialog',
  templateUrl: './custom-field-choice-edit-dialog.component.html',
  imports: [
    CheckComponent,
    SelectComponent,
    PermissionsFormComponent,
    TextComponent,
    IfOwnerDirective,
    FormsModule,
    ReactiveFormsModule,
  ],
})
export class CustomFieldChoiceEditDialogComponent extends EditDialogComponent<CustomFieldChoice> {
  constructor() {
    super()
    this.service = inject(CustomFieldChoiceService)
    this.userService = inject(UserService)
    this.settingsService = inject(SettingsService)
  }

  getCreateTitle() {
    return $localize`Create managed-select value`
  }

  getEditTitle() {
    return $localize`Edit managed-select value`
  }

  getForm(): FormGroup {
    return new FormGroup({
      custom_field: new FormControl(null),
      name: new FormControl(''),
      matching_algorithm: new FormControl(DEFAULT_MATCHING_ALGORITHM),
      match: new FormControl(''),
      is_insensitive: new FormControl(true),
      permissions_form: new FormControl(null),
    })
  }
}
