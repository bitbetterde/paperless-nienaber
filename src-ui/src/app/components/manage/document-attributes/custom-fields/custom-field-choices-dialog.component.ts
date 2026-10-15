import { Component, inject, Input, OnInit } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { NgbActiveModal, NgbModal, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap'
import { NgxBootstrapIconsModule } from 'ngx-bootstrap-icons'
import { ConfirmDialogComponent } from 'src/app/components/common/confirm-dialog/confirm-dialog.component'
import { CustomFieldChoiceEditDialogComponent } from 'src/app/components/common/edit-dialog/custom-field-choice-edit-dialog/custom-field-choice-edit-dialog.component'
import { EditDialogMode } from 'src/app/components/common/edit-dialog/edit-dialog.component'
import { CustomField } from 'src/app/data/custom-field'
import { CustomFieldChoice } from 'src/app/data/custom-field-choice'
import {
  CustomFieldQueryLogicalOperator,
  CustomFieldQueryOperator,
} from 'src/app/data/custom-field-query'
import { FILTER_CUSTOM_FIELDS_QUERY } from 'src/app/data/filter-rule-type'
import {
  MATCH_AUTO,
  MATCH_NONE,
  MATCHING_ALGORITHMS,
} from 'src/app/data/matching-model'
import { IfPermissionsDirective } from 'src/app/directives/if-permissions.directive'
import { DocumentListViewService } from 'src/app/services/document-list-view.service'
import {
  PermissionAction,
  PermissionType,
} from 'src/app/services/permissions.service'
import { CustomFieldChoiceService } from 'src/app/services/rest/custom-field-choice.service'
import { ToastService } from 'src/app/services/toast.service'

@Component({
  selector: 'pngx-custom-field-choices-dialog',
  templateUrl: './custom-field-choices-dialog.component.html',
  imports: [
    FormsModule,
    RouterModule,
    NgbPaginationModule,
    NgxBootstrapIconsModule,
    IfPermissionsDirective,
  ],
})
export class CustomFieldChoicesDialogComponent implements OnInit {
  @Input() customField: CustomField

  readonly PermissionAction = PermissionAction
  readonly PermissionType = PermissionType
  choices: CustomFieldChoice[] = []
  page = 1
  pageSize = 10
  count = 0
  search = ''
  loading = false

  readonly activeModal = inject(NgbActiveModal)
  private readonly modalService = inject(NgbModal)
  private readonly choiceService = inject(CustomFieldChoiceService)
  private readonly toastService = inject(ToastService)
  private readonly documentListViewService = inject(DocumentListViewService)

  ngOnInit(): void {
    this.reload()
  }

  reload() {
    this.loading = true
    this.choiceService
      .list(this.page, this.pageSize, 'name', false, {
        custom_field: this.customField.id,
        name__icontains: this.search || null,
      })
      .subscribe((result) => {
        this.choices = result.results
        this.count = result.count
        this.loading = false
      })
  }

  edit(choice: CustomFieldChoice = null) {
    const modal = this.modalService.open(CustomFieldChoiceEditDialogComponent, {
      backdrop: 'static',
    })
    modal.componentInstance.dialogMode.set(
      choice ? EditDialogMode.EDIT : EditDialogMode.CREATE
    )
    modal.componentInstance.object = choice ?? {
      custom_field: this.customField.id,
    }
    modal.componentInstance.succeeded.subscribe(() => {
      this.choiceService.clearCache()
      this.reload()
    })
  }

  delete(choice: CustomFieldChoice) {
    const modal = this.modalService.open(ConfirmDialogComponent, {
      backdrop: 'static',
    })
    modal.componentInstance.title = $localize`Confirm delete value`
    modal.componentInstance.messageBold = $localize`Documents using this value will retain the field with an empty value.`
    modal.componentInstance.btnClass = 'btn-danger'
    modal.componentInstance.btnCaption = $localize`Proceed`
    modal.componentInstance.confirmClicked.subscribe(() => {
      this.choiceService.delete(choice).subscribe({
        next: () => {
          modal.close()
          this.choiceService.clearCache()
          this.reload()
        },
        error: (error) =>
          this.toastService.showError($localize`Error deleting value.`, error),
      })
    })
  }

  getMatching(choice: CustomFieldChoice): string {
    if (choice.matching_algorithm === MATCH_AUTO) return $localize`Automatic`
    if (choice.matching_algorithm === MATCH_NONE) return $localize`None`
    const algorithm = MATCHING_ALGORITHMS.find(
      (item) => item.id === choice.matching_algorithm
    )
    return choice.match
      ? `${algorithm?.shortName ?? choice.matching_algorithm}: ${choice.match}`
      : '-'
  }

  getAccess(choice: CustomFieldChoice): string {
    if (choice.owner == null) return $localize`Unowned`
    return choice.user_can_change ? $localize`Change access` : $localize`View access`
  }

  getDocumentFilterUrl(choice: CustomFieldChoice) {
    return this.documentListViewService.getQuickFilterUrl([
      {
        rule_type: FILTER_CUSTOM_FIELDS_QUERY,
        value: JSON.stringify([
          CustomFieldQueryLogicalOperator.Or,
          [[this.customField.id, CustomFieldQueryOperator.Exact, choice.id]],
        ]),
      },
    ])
  }
}
