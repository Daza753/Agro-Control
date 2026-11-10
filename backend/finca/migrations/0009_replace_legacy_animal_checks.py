from django.db import migrations, models


SPECIES = [
    "bovino",
    "equino",
    "porcino",
    "caprino",
    "ovino",
    "otro",
    "vaca",
    "toro",
    "ternero",
    "caballo",
    "cerdo",
    "chivo",
    "oveja",
]


class Migration(migrations.Migration):
    dependencies = [
        ("finca", "0008_remove_sex_categories_and_normalize_default_species"),
    ]

    operations = [
        migrations.RunSQL(
            sql='ALTER TABLE "animals" DROP CONSTRAINT IF EXISTS "animals_species_check";',
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql='ALTER TABLE "animals" DROP CONSTRAINT IF EXISTS "animals_category_check";',
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.AddConstraint(
            model_name="animal",
            constraint=models.CheckConstraint(
                condition=models.Q(species__in=SPECIES),
                name="animal_species_valid",
            ),
        ),
    ]
