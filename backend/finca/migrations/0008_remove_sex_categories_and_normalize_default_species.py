from django.db import migrations


SPECIES_MAP = {
    "vaca": "bovino",
    "toro": "bovino",
    "ternero": "bovino",
    "caballo": "equino",
    "cerdo": "porcino",
    "chivo": "caprino",
    "oveja": "ovino",
}


def normalize_categories(apps, schema_editor):
    database = schema_editor.connection.alias
    AnimalCategory = apps.get_model("finca", "AnimalCategory")

    AnimalCategory.objects.using(database).filter(label__iexact="macho").delete()
    AnimalCategory.objects.using(database).filter(label__iexact="hembra").delete()

    for old_species, normalized_species in SPECIES_MAP.items():
        AnimalCategory.objects.using(database).filter(species=old_species).update(species=normalized_species)


def reverse_normalize_categories(apps, schema_editor):
    database = schema_editor.connection.alias
    AnimalCategory = apps.get_model("finca", "AnimalCategory")

    for old_species, normalized_species in SPECIES_MAP.items():
        AnimalCategory.objects.using(database).filter(species=normalized_species).update(species=old_species)


class Migration(migrations.Migration):
    dependencies = [
        ("finca", "0007_group_animal_species"),
    ]

    operations = [
        migrations.RunPython(normalize_categories, reverse_normalize_categories),
    ]
