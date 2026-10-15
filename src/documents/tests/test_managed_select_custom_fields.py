import json
from unittest import mock

import pytest
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.test import APITestCase

from documents.classifier import DocumentClassifier
from documents.matching import match_custom_field_choices
from documents.models import CustomField
from documents.models import CustomFieldChoice
from documents.models import CustomFieldInstance
from documents.models import MatchingModel
from documents.serialisers import CustomFieldInstanceSerializer
from documents.signals.handlers import set_managed_selects
from documents.tests.helpers import dummy_preprocess
from paperless_testing.factories import DocumentFactory
from paperless_testing.factories import UserFactory


class TestManagedSelectAPI(APITestCase):
    def setUp(self) -> None:
        self.user = UserFactory(username="managed-select-admin", superuser=True)
        self.client.force_authenticate(self.user)
        self.field = CustomField.objects.create(
            name="Customer",
            data_type=CustomField.FieldDataType.MANAGED_SELECT,
        )

    def test_choice_crud_and_document_value(self) -> None:
        response = self.client.post(
            "/api/custom_field_choices/",
            {
                "custom_field": self.field.pk,
                "name": "ACME",
                "matching_algorithm": MatchingModel.MATCH_LITERAL,
                "match": "ACME Corp",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        choice_id = response.json()["id"]

        document = DocumentFactory()
        response = self.client.patch(
            f"/api/documents/{document.pk}/",
            {"custom_fields": [{"field": self.field.pk, "value": choice_id}]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json()["custom_fields"],
            [{"field": self.field.pk, "value": choice_id}],
        )

        response = self.client.get(
            "/api/custom_field_choices/",
            {"custom_field": self.field.pk},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["count"], 1)
        self.assertEqual(response.json()["results"][0]["document_count"], 1)

    def test_choice_must_belong_to_managed_field(self) -> None:
        string_field = CustomField.objects.create(
            name="Text",
            data_type=CustomField.FieldDataType.STRING,
        )
        response = self.client.post(
            "/api/custom_field_choices/",
            {"custom_field": string_field.pk, "name": "Invalid"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cross_field_value_is_rejected(self) -> None:
        other_field = CustomField.objects.create(
            name="Recipient",
            data_type=CustomField.FieldDataType.MANAGED_SELECT,
        )
        choice = CustomFieldChoice.objects.create(
            custom_field=other_field,
            name="Wrong pool",
        )
        serializer = CustomFieldInstanceSerializer(
            data={"field": self.field.pk, "value": choice.pk},
            context={"request": mock.Mock(user=self.user)},
        )
        self.assertFalse(serializer.is_valid())

    def test_suggestions_are_grouped_by_custom_field(self) -> None:
        choice = CustomFieldChoice.objects.create(
            custom_field=self.field,
            name="ACME",
            matching_algorithm=MatchingModel.MATCH_LITERAL,
            match="ACME Corp",
        )
        document = DocumentFactory(content="Invoice from ACME Corp")

        response = self.client.get(f"/api/documents/{document.pk}/suggestions/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json()["custom_fields"],
            {str(self.field.pk): [choice.pk]},
        )

    def test_filter_documents_by_choice_id_or_name(self) -> None:
        choice = CustomFieldChoice.objects.create(
            custom_field=self.field,
            name="ACME",
        )
        document = DocumentFactory()
        CustomFieldInstance.objects.create(
            document=document,
            field=self.field,
            value_managed_select=choice,
        )

        for value in (choice.pk, choice.name):
            query = json.dumps(["AND", [[self.field.pk, "exact", value]]])
            response = self.client.get(
                "/api/documents/",
                {"custom_field_query": query},
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(
                [result["id"] for result in response.json()["results"]],
                [document.pk],
            )

    def test_field_with_choices_cannot_change_data_type(self) -> None:
        CustomFieldChoice.objects.create(custom_field=self.field, name="ACME")

        response = self.client.patch(
            f"/api/custom_fields/{self.field.pk}/",
            {"data_type": CustomField.FieldDataType.STRING},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_private_choice_cannot_be_newly_assigned_by_another_user(self) -> None:
        choice = CustomFieldChoice.objects.create(
            custom_field=self.field,
            name="Private",
            owner=self.user,
        )
        other_user = UserFactory(username="managed-select-other")
        serializer = CustomFieldInstanceSerializer(
            data={"field": self.field.pk, "value": choice.pk},
            context={"request": mock.Mock(user=other_user)},
        )

        self.assertFalse(serializer.is_valid())


@pytest.mark.django_db
def test_choice_deletion_nulls_value_and_field_deletion_cascades() -> None:
    field = CustomField.objects.create(
        name="Customer",
        data_type=CustomField.FieldDataType.MANAGED_SELECT,
    )
    choice = CustomFieldChoice.objects.create(custom_field=field, name="ACME")
    instance = CustomFieldInstance.objects.create(
        document=DocumentFactory(),
        field=field,
        value_managed_select=choice,
    )

    choice.delete()
    instance.refresh_from_db()
    assert instance.value_managed_select_id is None

    replacement = CustomFieldChoice.objects.create(custom_field=field, name="Other")
    field.delete()
    assert not CustomFieldChoice.objects.filter(pk=replacement.pk).exists()
    assert not CustomFieldInstance.objects.filter(pk=instance.pk).exists()


@pytest.mark.django_db
def test_choice_field_is_immutable() -> None:
    field = CustomField.objects.create(
        name="Customer",
        data_type=CustomField.FieldDataType.MANAGED_SELECT,
    )
    other = CustomField.objects.create(
        name="Recipient",
        data_type=CustomField.FieldDataType.MANAGED_SELECT,
    )
    choice = CustomFieldChoice.objects.create(custom_field=field, name="ACME")
    choice.custom_field = other
    with pytest.raises(ValidationError):
        choice.full_clean()


@pytest.mark.django_db
def test_rule_matching_and_assignment_are_isolated_per_field() -> None:
    customer = CustomField.objects.create(
        name="Customer",
        data_type=CustomField.FieldDataType.MANAGED_SELECT,
    )
    recipient = CustomField.objects.create(
        name="Recipient",
        data_type=CustomField.FieldDataType.MANAGED_SELECT,
    )
    customer_choice = CustomFieldChoice.objects.create(
        custom_field=customer,
        name="ACME Customer",
        match="ACME",
        matching_algorithm=MatchingModel.MATCH_LITERAL,
    )
    recipient_choice = CustomFieldChoice.objects.create(
        custom_field=recipient,
        name="ACME Recipient",
        match="ACME",
        matching_algorithm=MatchingModel.MATCH_LITERAL,
    )
    document = DocumentFactory(content="Invoice issued by ACME")

    matches = match_custom_field_choices(document, classifier=None)
    assert matches == {
        customer.pk: [customer_choice],
        recipient.pk: [recipient_choice],
    }

    selected = set_managed_selects(None, document)
    assert selected == {
        customer.pk: customer_choice,
        recipient.pk: recipient_choice,
    }
    assert document.custom_fields.get(field=customer).value == customer_choice.pk
    assert document.custom_fields.get(field=recipient).value == recipient_choice.pk


@pytest.mark.django_db
def test_assignment_preserves_existing_non_null_value() -> None:
    field = CustomField.objects.create(
        name="Customer",
        data_type=CustomField.FieldDataType.MANAGED_SELECT,
    )
    existing = CustomFieldChoice.objects.create(custom_field=field, name="Existing")
    matching = CustomFieldChoice.objects.create(
        custom_field=field,
        name="Matching",
        match="token",
        matching_algorithm=MatchingModel.MATCH_LITERAL,
    )
    document = DocumentFactory(content="token")
    CustomFieldInstance.objects.create(
        document=document,
        field=field,
        value_managed_select=existing,
    )

    assert set_managed_selects(None, document) == {}
    assert document.custom_fields.get(field=field).value == existing.pk

    selected = set_managed_selects(None, document, replace=True)
    assert selected == {field.pk: matching}
    assert document.custom_fields.get(field=field).value == matching.pk


@pytest.mark.django_db
def test_classifier_trains_independent_managed_select_fields() -> None:
    customer = CustomField.objects.create(
        name="Customer",
        data_type=CustomField.FieldDataType.MANAGED_SELECT,
    )
    category = CustomField.objects.create(
        name="Category",
        data_type=CustomField.FieldDataType.MANAGED_SELECT,
    )
    customer_choice = CustomFieldChoice.objects.create(
        custom_field=customer,
        name="ACME",
        matching_algorithm=MatchingModel.MATCH_AUTO,
    )
    category_choice = CustomFieldChoice.objects.create(
        custom_field=category,
        name="Invoice",
        matching_algorithm=MatchingModel.MATCH_AUTO,
    )
    customer_document = DocumentFactory(content="document from acme customer")
    category_document = DocumentFactory(content="invoice category document")
    CustomFieldInstance.objects.create(
        document=customer_document,
        field=customer,
        value_managed_select=customer_choice,
    )
    CustomFieldInstance.objects.create(
        document=category_document,
        field=category,
        value_managed_select=category_choice,
    )
    classifier = DocumentClassifier()
    classifier.preprocess_content = mock.MagicMock(side_effect=dummy_preprocess)

    assert classifier.train()
    assert set(classifier.custom_field_choice_classifiers) == {
        customer.pk,
        category.pk,
    }
    assert set(classifier.custom_field_choice_classifiers[customer.pk].classes_) == {
        -1,
        customer_choice.pk,
    }
    assert set(classifier.custom_field_choice_classifiers[category.pk].classes_) == {
        -1,
        category_choice.pk,
    }
    assert not classifier.train()

    replacement = CustomFieldChoice.objects.create(
        custom_field=customer,
        name="Globex",
        matching_algorithm=MatchingModel.MATCH_AUTO,
    )
    customer_instance = customer_document.custom_fields.get(field=customer)
    customer_instance.value_managed_select = replacement
    customer_instance.save()

    assert classifier.train()
