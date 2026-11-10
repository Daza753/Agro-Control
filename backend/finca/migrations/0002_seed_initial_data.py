import uuid

from django.db import migrations


MODULES = [
    ("dashboard", "Inicio", True),
    ("animals", "Animales", True),
    ("milk", "Produccion de Leche", True),
    ("vaccines", "Vacunas", True),
    ("medications", "Medicamentos", True),
    ("inputs", "Insumos", True),
    ("equipment", "Equipos", True),
    ("crops", "Cultivos", True),
    ("fish", "Piscicultura", True),
    ("activities", "Actividades", True),
    ("diseases", "Enfermedades", True),
    ("reports", "Reportes", False),
    ("users", "Usuarios", False),
    ("settings", "Configuracion", False),
]

ANIMAL_CATEGORIES = [
    ("NV", "Novilla", "bovino", "#0ea5e9"),
    ("NO", "Novillo", "bovino", "#6366f1"),
    ("TR", "Ternera", "bovino", "#f59e0b"),
    ("TE", "Ternero", "bovino", "#f97316"),
    ("TT", "Torete", "bovino", "#ef4444"),
    ("TO", "Toro", "bovino", "#dc2626"),
    ("VA", "Vaca", "bovino", "#059669"),
    ("EQ", "Equino", "equino", "#8b5cf6"),
    ("PO", "Potro", "equino", "#a78bfa"),
    ("YE", "Yegua", "equino", "#c4b5fd"),
    ("CH", "Chivo", "caprino", "#84cc16"),
    ("CA", "Cabra", "caprino", "#a3e635"),
    ("CE", "Cerdo", "porcino", "#fb923c"),
    ("OV", "Oveja", "ovino", "#34d399"),
    ("CO", "Cordero", "ovino", "#6ee7b7"),
]


def seed_defaults(apps, schema_editor):
    database = schema_editor.connection.alias
    ModuleAccess = apps.get_model("accounts", "ModuleAccess")
    ModuleTheme = apps.get_model("finca", "ModuleTheme")
    AnimalCategory = apps.get_model("finca", "AnimalCategory")
    FarmSettings = apps.get_model("finca", "FarmSettings")

    for module_key, label, enabled in MODULES:
        ModuleAccess.objects.using(database).get_or_create(
            module_key=module_key,
            defaults={"label": label, "enabled_for_workers": enabled},
        )
        ModuleTheme.objects.using(database).get_or_create(module_key=module_key)

    for code, label, species, color in ANIMAL_CATEGORIES:
        AnimalCategory.objects.using(database).get_or_create(
            code=code,
            species=species,
            defaults={"label": label, "color": color, "is_default": True},
        )

    FarmSettings.objects.using(database).get_or_create(
        id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
        defaults={"farm_name": "Mi Finca"},
    )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_existing_profiles"),
        ("finca", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_defaults, migrations.RunPython.noop),
    ]
