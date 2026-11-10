import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Profile",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("email", models.EmailField(max_length=254)),
                ("full_name", models.CharField(blank=True, max_length=200)),
                (
                    "role",
                    models.CharField(
                        choices=[("admin", "Administrador"), ("trabajador", "Trabajador")],
                        default="trabajador",
                        max_length=20,
                    ),
                ),
                ("active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_profiles",
                        db_column="created_by",
                        to="accounts.profile",
                    ),
                ),
            ],
            options={"db_table": "profiles"},
        ),
        migrations.CreateModel(
            name="ModuleAccess",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("module_key", models.CharField(max_length=80, unique=True)),
                ("enabled_for_workers", models.BooleanField(default=True)),
                ("label", models.CharField(max_length=120)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="updated_module_access",
                        db_column="updated_by",
                        to="accounts.profile",
                    ),
                ),
            ],
            options={"db_table": "module_access"},
        ),
    ]
