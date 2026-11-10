from rest_framework.routers import DefaultRouter
from django.urls import path

from finca.sync_api import SyncOperationsView
from finca.api import (
    AnimalCategoryViewSet,
    AnimalViewSet,
    CropViewSet,
    DailyActivityViewSet,
    DiseaseReportViewSet,
    EquipmentViewSet,
    FarmSettingsViewSet,
    FishPondViewSet,
    InputViewSet,
    MedicationViewSet,
    MilkProductionViewSet,
    ModuleAccessViewSet,
    ModuleThemeViewSet,
    VaccineViewSet,
    WorkerActivityReportView,
)


router = DefaultRouter()
router.register("animals", AnimalViewSet, basename="animal")
router.register("animal-categories", AnimalCategoryViewSet, basename="animal-category")
router.register("milk-production", MilkProductionViewSet, basename="milk-production")
router.register("vaccines", VaccineViewSet, basename="vaccine")
router.register("daily-activities", DailyActivityViewSet, basename="daily-activity")
router.register("disease-reports", DiseaseReportViewSet, basename="disease-report")
router.register("medications", MedicationViewSet, basename="medication")
router.register("inputs", InputViewSet, basename="input")
router.register("equipment", EquipmentViewSet, basename="equipment")
router.register("crops", CropViewSet, basename="crop")
router.register("fish-farming", FishPondViewSet, basename="fish-farming")
router.register("farm-settings", FarmSettingsViewSet, basename="farm-settings")
router.register("module-access", ModuleAccessViewSet, basename="module-access")
router.register("module-themes", ModuleThemeViewSet, basename="module-theme")

urlpatterns = [
    path("sync/snapshot/", SyncOperationsView.as_view(), name="sync-snapshot"),
    path("sync/", SyncOperationsView.as_view(), name="sync-operations"),
    path(
        "reports/worker-activities/",
        WorkerActivityReportView.as_view(),
        name="worker-activity-report",
    ),
    *router.urls,
]
