from django.db import migrations, models


SPECIES_MAP = {
    "vaca": "bovino",
    "toro": "bovino",
    "ternero": "bovino",
    "caballo": "equino",
    "cerdo": "porcino",
    "chivo": "caprino",
    "oveja": "ovino",
}


def group_species(apps, schema_editor):
    database = schema_editor.connection.alias
    Animal = apps.get_model("finca", "Animal")
    AnimalCategory = apps.get_model("finca", "AnimalCategory")
    for old_species, species in SPECIES_MAP.items():
        Animal.objects.using(database).filter(species=old_species).update(species=species)
        AnimalCategory.objects.using(database).filter(species=old_species).update(species=species)


def ungroup_species(apps, schema_editor):
    database = schema_editor.connection.alias
    Animal = apps.get_model("finca", "Animal")
    AnimalCategory = apps.get_model("finca", "AnimalCategory")
    for old_species, species in SPECIES_MAP.items():
        Animal.objects.using(database).filter(species=species).update(species=old_species)
        AnimalCategory.objects.using(database).filter(species=species).update(species=old_species)


class Migration(migrations.Migration):
    dependencies = [
        ("finca", "0006_activitysubmission"),
    ]

    operations = [
        migrations.RunPython(group_species, ungroup_species),
        migrations.AlterField(
            model_name="animal",
            name="species",
            field=models.CharField(
                choices=[
                    ("bovino", "Bovino"),
                    ("equino", "Equino"),
                    ("porcino", "Porcino"),
                    ("caprino", "Caprino"),
                    ("ovino", "Ovino"),
                    ("otro", "Otro"),
                    ("vaca", "Vaca (antiguo)"),
                    ("toro", "Toro (antiguo)"),
                    ("ternero", "Ternero (antiguo)"),
                    ("caballo", "Caballo (antiguo)"),
                    ("cerdo", "Cerdo (antiguo)"),
                    ("chivo", "Chivo (antiguo)"),
                    ("oveja", "Oveja (antiguo)"),
                ],
                max_length=20,
            ),
        ),
    ]
