from django.db import migrations


EXPECTED_CATEGORIES = (
    ("NV", "Novilla", "#0ea5e9"),
    ("NO", "Novillo", "#6366f1"),
    ("TR", "Ternera", "#f59e0b"),
    ("TE", "Ternero", "#f97316"),
    ("TT", "Torete", "#ef4444"),
    ("TO", "Toro", "#dc2626"),
    ("VA", "Vaca", "#059669"),
)

RENAMED_CODES = (
    ("VC", "VA"),
    ("NX", "NO"),
    ("TN", "TR"),
)


def enforce_bovine_categories(apps, schema_editor):
    database = schema_editor.connection.alias
    Animal = apps.get_model("finca", "Animal")
    AnimalCategory = apps.get_model("finca", "AnimalCategory")

    for old_code, new_code in RENAMED_CODES:
        old_category = AnimalCategory.objects.using(database).filter(
            species="bovino",
            code=old_code,
        ).first()
        new_category = AnimalCategory.objects.using(database).filter(
            species="bovino",
            code=new_code,
        ).first()

        if old_category and not old_category.is_default:
            replacement = f"CUS_{old_code}"
            suffix = 2
            while AnimalCategory.objects.using(database).filter(
                species="bovino",
                code=replacement,
            ).exclude(pk=old_category.pk).exists():
                replacement = f"CUS_{old_code}_{suffix}"
                suffix += 1
            Animal.objects.using(database).filter(
                species="bovino",
                category=old_code,
            ).update(category=replacement)
            old_category.code = replacement
            old_category.save(using=database, update_fields=["code"])
        elif old_category and new_category and old_category.pk != new_category.pk:
            if not new_category.is_default:
                replacement = f"CUS_{new_code}"
                suffix = 2
                while AnimalCategory.objects.using(database).filter(
                    species="bovino",
                    code=replacement,
                ).exclude(pk=new_category.pk).exists():
                    replacement = f"CUS_{new_code}_{suffix}"
                    suffix += 1
                Animal.objects.using(database).filter(
                    species="bovino",
                    category=new_code,
                ).update(category=replacement)
                new_category.code = replacement
                new_category.save(using=database, update_fields=["code"])

            old_category.delete(using=database)
        elif old_category and old_category.pk != (new_category.pk if new_category else None):
            old_category.code = new_code
            old_category.save(using=database, update_fields=["code"])

        Animal.objects.using(database).filter(
            species="bovino",
            category=old_code,
        ).update(category=new_code)

    for code, label, color in EXPECTED_CATEGORIES:
        AnimalCategory.objects.using(database).update_or_create(
            species="bovino",
            code=code,
            defaults={
                "label": label,
                "color": color,
                "is_default": True,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("finca", "0010_correct_bovine_category_codes"),
    ]

    operations = [
        migrations.RunPython(enforce_bovine_categories, migrations.RunPython.noop),
    ]
