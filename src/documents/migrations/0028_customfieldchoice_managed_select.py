import django.db.models.deletion
from django.conf import settings
from django.db import migrations
from django.db import models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("documents", "0027_documentbarcode"),
    ]

    operations = [
        migrations.AlterField(
            model_name="customfield",
            name="data_type",
            field=models.CharField(
                choices=[
                    ("string", "String"),
                    ("url", "URL"),
                    ("date", "Date"),
                    ("boolean", "Boolean"),
                    ("integer", "Integer"),
                    ("float", "Float"),
                    ("monetary", "Monetary"),
                    ("documentlink", "Document Link"),
                    ("select", "Select"),
                    ("managed_select", "Managed Select"),
                    ("longtext", "Long Text"),
                ],
                editable=False,
                max_length=50,
                verbose_name="data type",
            ),
        ),
        migrations.CreateModel(
            name="CustomFieldChoice",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=128, verbose_name="name")),
                (
                    "match",
                    models.CharField(blank=True, max_length=256, verbose_name="match"),
                ),
                (
                    "matching_algorithm",
                    models.PositiveSmallIntegerField(
                        choices=[
                            (0, "None"),
                            (1, "Any word"),
                            (2, "All words"),
                            (3, "Exact match"),
                            (4, "Regular expression"),
                            (5, "Fuzzy word"),
                            (6, "Automatic"),
                        ],
                        default=1,
                        verbose_name="matching algorithm",
                    ),
                ),
                (
                    "is_insensitive",
                    models.BooleanField(default=True, verbose_name="is insensitive"),
                ),
                (
                    "custom_field",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="choices",
                        to="documents.customfield",
                        verbose_name="custom field",
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        blank=True,
                        default=None,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="owner",
                    ),
                ),
            ],
            options={
                "verbose_name": "custom field choice",
                "verbose_name_plural": "custom field choices",
                "ordering": ("name",),
            },
        ),
        migrations.AddConstraint(
            model_name="customfieldchoice",
            constraint=models.UniqueConstraint(
                fields=("custom_field", "name", "owner"),
                name="documents_customfieldchoice_unique_field_name_owner",
            ),
        ),
        migrations.AddConstraint(
            model_name="customfieldchoice",
            constraint=models.UniqueConstraint(
                condition=models.Q(("owner__isnull", True)),
                fields=("custom_field", "name"),
                name="documents_customfieldchoice_unique_unowned_field_name",
            ),
        ),
        migrations.AddField(
            model_name="customfieldinstance",
            name="value_managed_select",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="field_instances",
                to="documents.customfieldchoice",
            ),
        ),
    ]
