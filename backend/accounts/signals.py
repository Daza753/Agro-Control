from django.db.models.signals import post_save
from django.dispatch import receiver

from accounts.farms import create_farm
from accounts.models import Profile, User


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        profile = Profile.objects.create(
            id=instance.pk,
            email=instance.email,
            user=instance,
            active=instance.is_active,
            role=Profile.Role.ADMIN if instance.is_superuser else Profile.Role.WORKER,
        )
        if profile.role == Profile.Role.ADMIN:
            create_farm(profile, "Mi Finca")
