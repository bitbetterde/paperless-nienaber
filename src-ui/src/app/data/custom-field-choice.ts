import { MatchingModel } from './matching-model'
import { ObjectWithPermissions } from './object-with-permissions'

export interface CustomFieldChoice
  extends MatchingModel, ObjectWithPermissions {
  custom_field: number
}
