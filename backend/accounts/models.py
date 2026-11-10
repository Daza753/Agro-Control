import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from accounts.managers import UserManager


class Farm(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    owner = models.ForeignKey(
        "accounts.Profile",
        on_delete=models.PROTECT,
        related_name="farms",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "farms"
        constraints = [
            models.UniqueConstraint(fields=["owner", "name"], name="farm_owner_name_uniq")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email


class Profile(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Administrador"
        WORKER = "trabajador", "Trabajador"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField()
    full_name = models.CharField(max_length=200, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.WORKER)
    active = models.BooleanField(default=True)
    photo_url = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_profiles",
        db_column="created_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    farm = models.ForeignKey(
        "accounts.Farm",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="employees",
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )

    def __str__(self):
        return self.full_name or self.email

    class Meta:
        db_table = "profiles"


class ModuleAccess(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farm = models.ForeignKey(Farm, null=True, blank=True, on_delete=models.CASCADE, related_name="module_access")
    module_key = models.CharField(max_length=80)
    enabled_for_workers = models.BooleanField(default=True)
    label = models.CharField(max_length=120)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        Profile,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="updated_module_access",
        db_column="updated_by",
    )

    def __str__(self):
        return self.label

    class Meta:
        db_table = "module_access"
        constraints = [
            models.UniqueConstraint(
                fields=["farm", "module_key"], name="module_access_farm_key_uniq"
            )
        ]
