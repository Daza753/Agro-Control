from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


def link_existing_profiles(apps, schema_editor):
    Profile = apps.get_model("accounts", "Profile")
    User = apps.get_model("accounts", "User")
    database = schema_editor.connection.alias

    seen_emails = set()
    profiles = Profile.objects.using(database).all().iterator()
    for profile in profiles:
        email_key = profile.email.strip().casefold()
        if email_key in seen_emails:
            raise RuntimeError(
                "No se pueden enlazar perfiles: hay correos duplicados "
                "ignorando mayúsculas/minúsculas."
            )
        seen_emails.add(email_key)

        user, _ = User.objects.using(database).get_or_create(
            email=profile.email,
            defaults={
                "id": profile.pk,
                "is_active": profile.active,
                "password": "!",
            },
        )
        profile.user_id = user.pk
        profile.save(using=database, update_fields=["user"])


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_existing_profiles"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="user",
            field=models.OneToOneField(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="profile",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(link_existing_profiles, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="profile",
            name="user",
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="profile",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
