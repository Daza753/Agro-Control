from django.db import transaction

from accounts.models import Farm, ModuleAccess
from finca.models import FarmSettings, ModuleTheme


DEFAULT_MODULES = (
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
)


def _model_values(instance, excluded_fields):
    return {
        field.name: getattr(instance, field.attname)
        for field in instance._meta.concrete_fields
        if field.name not in excluded_fields
    }


@transaction.atomic
def create_farm(owner, name):
    farm = Farm.objects.create(owner=owner, name=name)
    template = owner.farms.exclude(pk=farm.pk).first()

    settings_template = (
        FarmSettings.objects.filter(farm=template).first()
        if template
        else FarmSettings.objects.filter(farm__isnull=True).first()
    )
    if settings_template:
        settings = _model_values(
            settings_template, {"id", "farm", "updated_at", "updated_by"}
        )
        settings["farm_name"] = name
        FarmSettings.objects.create(farm=farm, **settings)
    else:
        FarmSettings.objects.create(farm=farm, farm_name=name)

    access_templates = (
        ModuleAccess.objects.filter(farm=template)
        if template
        else ModuleAccess.objects.filter(farm__isnull=True)
    )
    access_rows = list(access_templates)
    if access_rows:
        for access in access_rows:
            ModuleAccess.objects.create(
                farm=farm,
                module_key=access.module_key,
                enabled_for_workers=access.enabled_for_workers,
                label=access.label,
            )
    else:
        for module_key, label, enabled in DEFAULT_MODULES:
            ModuleAccess.objects.create(
                farm=farm,
                module_key=module_key,
                label=label,
                enabled_for_workers=enabled,
            )

    theme_templates = (
        ModuleTheme.objects.filter(farm=template)
        if template
        else ModuleTheme.objects.filter(farm__isnull=True)
    )
    theme_rows = list(theme_templates)
    if theme_rows:
        for theme in theme_rows:
            values = _model_values(theme, {"id", "farm", "updated_at", "updated_by"})
            ModuleTheme.objects.create(farm=farm, **values)
    else:
        for module_key, _, _ in DEFAULT_MODULES:
            ModuleTheme.objects.create(farm=farm, module_key=module_key)

    return farm
