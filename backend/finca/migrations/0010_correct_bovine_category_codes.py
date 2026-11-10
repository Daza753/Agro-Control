from django.db import migrations


CATEGORY_CODES = (
    ("VC", "VA", "Vaca"),
    ("NX", "NO", "Novillo"),
    ("TN", "TR", "Ternera"),
)


def correct_bovine_categories(apps, schema_editor):
    database = schema_editor.connection.alias
    Animal = apps.get_model("finca", "Animal")
    AnimalCategory = apps.get_model("finca", "AnimalCategory")

    Animal.objects.using(database).exclude(
        species="bovino",
        sex="hembra",
    ).exclude(
        lactation_status__isnull=True,
    ).update(lactation_status=None)

    for old_code, new_code, label in CATEGORY_CODES:
        source = AnimalCategory.objects.using(database).filter(
            species="bovino",
            code=old_code,
        ).first()
        target = AnimalCategory.objects.using(database).filter(
            species="bovino",
            code=new_code,
        ).first()

        if target and source and target.pk != source.pk and not target.is_default:
            base = f"CUS_{new_code}"
            replacement = base
            suffix = 2
            while AnimalCategory.objects.using(database).filter(
                species="bovino",
                code=replacement,
            ).exclude(pk=target.pk).exists():
                replacement = f"{base}_{suffix}"
                suffix += 1
            Animal.objects.using(database).filter(
                species="bovino",
                category=new_code,
            ).update(category=replacement)
            target.code = replacement
            target.save(using=database, update_fields=["code"])
            target = None

        Animal.objects.using(database).filter(
            species="bovino",
            category=old_code,
        ).update(category=new_code)

        if source and target and source.pk != target.pk:
            source.delete(using=database)
            source = None

        category = source or target
        if category:
            category.code = new_code
            category.label = label
            category.is_default = True
            category.save(using=database, update_fields=["code", "label", "is_default"])


class Migration(migrations.Migration):
    dependencies = [
        ("finca", "0009_replace_legacy_animal_checks"),
    ]

    operations = [
        migrations.RunPython(correct_bovine_categories, migrations.RunPython.noop),
    ]
