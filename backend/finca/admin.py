from django.contrib import admin

from finca import models


for model in (
    models.Animal,
    models.AnimalCategory,
    models.Crop,
    models.DailyActivity,
    models.DiseaseReport,
    models.Equipment,
    models.FarmSettings,
    models.FishPond,
    models.Input,
    models.Medication,
    models.MilkProduction,
    models.ModuleTheme,
    models.Vaccine,
):
    admin.site.register(model)
