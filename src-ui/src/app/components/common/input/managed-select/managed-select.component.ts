import {
  Component,
  EventEmitter,
  forwardRef,
  inject,
  Input,
  Output,
} from '@angular/core'
import { FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { CustomFieldChoiceEditDialogComponent } from '../../edit-dialog/custom-field-choice-edit-dialog/custom-field-choice-edit-dialog.component'
import { EditDialogMode } from '../../edit-dialog/edit-dialog.component'
import { CustomField } from 'src/app/data/custom-field'
import { CustomFieldChoice } from 'src/app/data/custom-field-choice'
import {
  PermissionAction,
  PermissionsService,
  PermissionType,
} from 'src/app/services/permissions.service'
import { CustomFieldChoiceService } from 'src/app/services/rest/custom-field-choice.service'
import { AbstractInputComponent } from '../abstract-input'
import { SelectComponent } from '../select/select.component'

@Component({
  selector: 'pngx-input-managed-select',
  templateUrl: './managed-select.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ManagedSelectComponent),
      multi: true,
    },
  ],
  imports: [FormsModule, SelectComponent],
})
export class ManagedSelectComponent extends AbstractInputComponent<number> {
  private readonly choiceService = inject(CustomFieldChoiceService)
  private readonly modalService = inject(NgbModal)
  private readonly permissionsService = inject(PermissionsService)

  // undefined until loaded: with an empty array the select would already turn
  // the current value into a "Private" placeholder
  choices: CustomFieldChoice[]
  private _customField: CustomField

  @Input()
  set customField(field: CustomField) {
    this._customField = field
    this.loadChoices()
  }

  get customField(): CustomField {
    return this._customField
  }

  @Input() suggestions: number[]
  @Input() showFilter = false
  @Output() filterDocuments = new EventEmitter<CustomFieldChoice[]>()

  get canCreate(): boolean {
    return this.permissionsService.currentUserCan(
      PermissionAction.Add,
      PermissionType.CustomFieldChoice
    )
  }

  private loadChoices(selectedId?: number) {
    if (!this.customField?.id) return
    this.choiceService
      .list(1, 100000, 'name', false, {
        custom_field: this.customField.id,
      })
      .subscribe((result) => {
        this.choices = result.results
        if (selectedId) {
          this.value = selectedId
          this.onChange(selectedId)
        }
        this.changeDetector.markForCheck()
      })
  }

  createChoice(name: string) {
    const modal = this.modalService.open(CustomFieldChoiceEditDialogComponent, {
      backdrop: 'static',
    })
    modal.componentInstance.dialogMode.set(EditDialogMode.CREATE)
    modal.componentInstance.object = {
      custom_field: this.customField.id,
      name,
    }
    modal.componentInstance.succeeded.subscribe((choice: CustomFieldChoice) => {
      this.choiceService.clearCache()
      this.loadChoices(choice.id)
    })
  }
}
