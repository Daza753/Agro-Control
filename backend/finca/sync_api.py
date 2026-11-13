import json
import logging
import re
import uuid

from django.core.serializers.json import DjangoJSONEncoder
from django.db import IntegrityError, transaction
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.farm_access import get_request_farm
from accounts.models import ModuleAccess, Profile
from finca.activity_submissions import (
    record_activity_submission,
    record_deleted_activity_submission,
    serialize_activity,
)
from finca.models import (
    ActivitySubmission,
    Animal,
    AnimalCategory,
    Crop,
    DailyActivity,
    DiseaseReport,
    Equipment,
    FarmSettings,
    FishPond,
    Input,
    Medication,
    MilkProduction,
    ModuleTheme,
    SyncOperation,
    Vaccine,
)
from finca.serializers import (
    AnimalCategorySerializer,
    AnimalSerializer,
    CropSerializer,
    DailyActivitySerializer,
    DiseaseReportSerializer,
    EquipmentSerializer,
    FarmSettingsSerializer,
    FishPondSerializer,
    InputSerializer,
    MedicationSerializer,
    MilkProductionSerializer,
    ModuleAccessSerializer,
    ModuleThemeSerializer,
    VaccineSerializer,
)


RESOURCE_MAP = {
    "animals": (Animal, AnimalSerializer, "animals"),
    "animal-categories": (AnimalCategory, AnimalCategorySerializer, "animals"),
    "milk-production": (MilkProduction, MilkProductionSerializer, "milk"),
    "vaccines": (Vaccine, VaccineSerializer, "vaccines"),
    "daily-activities": (DailyActivity, DailyActivitySerializer, "activities"),
    "disease-reports": (DiseaseReport, DiseaseReportSerializer, "diseases"),
    "medications": (Medication, MedicationSerializer, "medications"),
    "inputs": (Input, InputSerializer, "inputs"),
    "equipment": (Equipment, EquipmentSerializer, "equipment"),
    "crops": (Crop, CropSerializer, "crops"),
    "fish-farming": (FishPond, FishPondSerializer, "fish"),
    "farm-settings": (FarmSettings, FarmSettingsSerializer, None),
    "module-themes": (ModuleTheme, ModuleThemeSerializer, None),
}
PATH_PATTERN = re.compile(r"^/api/([a-z-]+)/(?:([0-9a-fA-F-]{36})/)?$")
ADMIN_ONLY = {"animal-categories", "farm-settings", "module-themes"}
logger = logging.getLogger(__name__)


class SyncOperationsView(APIView):
    """Apply queued farm mutations with idempotency and optimistic conflict checks."""

    def get(self, request):
        profile = request.user.profile
        if not request.user.is_active or not profile.active:
            raise PermissionDenied("La cuenta está inactiva.")
        farm = get_request_farm(request)
        definitions = {
            "animals": (Animal.objects.filter(farm=farm).order_by("ica_code"), AnimalSerializer, "animals"),
            "animal-categories": (AnimalCategory.objects.all(), AnimalCategorySerializer, "animals"),
            "milk-production": (MilkProduction.objects.filter(animal__farm=farm).select_related("animal", "registered_by"), MilkProductionSerializer, "milk"),
            "vaccines": (Vaccine.objects.filter(farm=farm).select_related("animal", "applied_by"), VaccineSerializer, "vaccines"),
            "vaccines/medication-options": (Medication.objects.filter(farm=farm), MedicationSerializer, "vaccines"),
            "daily-activities": (DailyActivity.objects.filter(farm=farm).select_related("animal", "worker"), DailyActivitySerializer, "activities"),
            "disease-reports": (DiseaseReport.objects.filter(farm=farm).select_related("animal", "reported_by"), DiseaseReportSerializer, "diseases"),
            "medications": (Medication.objects.filter(farm=farm), MedicationSerializer, "medications"),
            "inputs": (Input.objects.filter(farm=farm), InputSerializer, "inputs"),
            "equipment": (Equipment.objects.filter(farm=farm), EquipmentSerializer, "equipment"),
            "crops": (Crop.objects.filter(farm=farm), CropSerializer, "crops"),
            "fish-farming": (FishPond.objects.filter(farm=farm), FishPondSerializer, "fish"),
            "farm-settings": (FarmSettings.objects.filter(farm=farm), FarmSettingsSerializer, None),
            "module-access": (ModuleAccess.objects.filter(farm=farm), ModuleAccessSerializer, None),
            "module-themes": (ModuleTheme.objects.filter(farm=farm), ModuleThemeSerializer, None),
        }
        resources = {}
        for endpoint, (queryset, serializer_class, module_key) in definitions.items():
            enabled = module_key is None or profile.role == Profile.Role.ADMIN or not ModuleAccess.objects.filter(
                farm=farm,
                module_key=module_key,
                enabled_for_workers=False,
            ).exists()
            resources[f"/api/{endpoint}/"] = (
                serializer_class(queryset, many=True, context={"request": request}).data
                if enabled else []
            )
        return Response({"farm_id": str(farm.pk), "resources": resources})

    def post(self, request):
        profile = request.user.profile
        if not request.user.is_active or not profile.active:
            raise PermissionDenied("La cuenta está inactiva.")
        operations = request.data.get("operations")
        if not isinstance(operations, list) or not operations or len(operations) > 100:
            return Response(
                {"detail": "Envía entre 1 y 100 operaciones."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        farm = get_request_farm(request)
        results = [self.apply_operation(request, farm, operation) for operation in operations]
        return Response({"results": results})

    def apply_operation(self, request, farm, operation):
        profile = request.user.profile
        if not isinstance(operation, dict):
            return {"status": "rejected", "error": "La operación no es válida."}
        try:
            operation_id = uuid.UUID(str(operation["id"]))
            operation_farm_id = uuid.UUID(str(operation["farm_id"]))
            method = str(operation["method"]).upper()
            match = PATH_PATTERN.fullmatch(str(operation["path"]).split("?", 1)[0])
            if not match:
                raise ValueError
            resource, object_id = match.groups()
            if object_id:
                object_id = str(uuid.UUID(object_id))
            if resource not in RESOURCE_MAP or resource == "module-access":
                return {"id": str(operation_id), "status": "rejected", "error": "Recurso no sincronizable."}
            if method not in {"POST", "PUT", "PATCH", "DELETE"}:
                raise ValueError
            if resource == "animal-categories" and method in {"PUT", "PATCH"}:
                return {"id": str(operation_id), "status": "rejected", "error": "Las categorías no admiten edición."}
            if (method == "POST") == (object_id is not None):
                raise ValueError
            body = operation.get("body")
            base_state = operation.get("base_state")
            if method != "DELETE" and not isinstance(body, dict):
                raise ValueError
            if method != "DELETE" and self.contains_sensitive_field(body):
                return {
                    "id": str(operation_id),
                    "status": "rejected",
                    "error": "Los campos de contraseña o credenciales no se pueden sincronizar.",
                }
            if method in {"PUT", "PATCH", "DELETE"} and not isinstance(base_state, dict):
                return {
                    "id": str(operation_id),
                    "status": "rejected",
                    "error": "No hay una versión local confirmada para comparar.",
                }
        except (KeyError, TypeError, ValueError):
            return {"status": "rejected", "error": "La operación no tiene un formato válido."}
        if operation_farm_id != farm.pk:
            return {
                "id": str(operation_id),
                "status": "rejected",
                "error": "La finca de la operación no coincide con la finca autorizada.",
            }

        receipt = SyncOperation.objects.filter(user=request.user, operation_id=operation_id).first()
        if receipt:
            if receipt.farm_id != farm.pk:
                return {"id": str(operation_id), "status": "rejected", "error": "La finca no coincide con la operación."}
            return {**receipt.result, "status": "applied", "replayed": True}

        model, serializer_class, module_key = RESOURCE_MAP[resource]
        if resource in ADMIN_ONLY and profile.role != Profile.Role.ADMIN:
            return {"id": str(operation_id), "status": "rejected", "error": "Esta operación requiere un administrador."}
        if module_key:
            allowed = ModuleAccess.objects.filter(
                farm=farm,
                module_key=module_key,
                enabled_for_workers=False,
            ).exists()
            if profile.role != Profile.Role.ADMIN and allowed:
                return {"id": str(operation_id), "status": "rejected", "error": "El módulo ya no está habilitado para tu perfil."}

        try:
            with transaction.atomic():
                instance = None
                if object_id:
                    queryset = model.objects.select_for_update()
                    if resource == "animal-categories":
                        queryset = queryset
                    elif resource == "milk-production":
                        queryset = queryset.filter(animal__farm=farm)
                    else:
                        queryset = queryset.filter(farm=farm)
                    instance = queryset.get(pk=object_id)
                    receipt = SyncOperation.objects.filter(
                        user=request.user,
                        operation_id=operation_id,
                    ).first()
                    if receipt:
                        if receipt.farm_id != farm.pk:
                            return {"id": str(operation_id), "status": "rejected", "error": "La finca no coincide con la operación."}
                        return {**receipt.result, "status": "applied", "replayed": True}
                    current = serializer_class(instance).data
                    if method == "PATCH":
                        changed_fields = (
                            key for key in body
                            if self.normalize(current.get(key)) != self.normalize(base_state.get(key))
                            and self.normalize(current.get(key)) != self.normalize(body.get(key))
                        )
                        has_conflict = next(changed_fields, None) is not None
                    else:
                        has_conflict = self.normalize(current) != self.normalize(base_state)
                    if has_conflict and method != "DELETE":
                        return {
                            "id": str(operation_id),
                            "status": "conflict",
                            "server": current,
                            "local": body,
                            "error": "El registro cambió en el servidor desde la última sincronización.",
                        }

                if method == "DELETE":
                    if resource == "animal-categories" and instance.is_default:
                        return {
                            "id": str(operation_id),
                            "status": "rejected",
                            "error": "Las categorías por defecto no se pueden eliminar.",
                        }
                    if resource == "daily-activities":
                        record_deleted_activity_submission(instance, profile)
                    instance.delete()
                    result = {"id": str(operation_id), "status": "applied", "data": None}
                else:
                    serializer = serializer_class(
                        instance=instance,
                        data=body,
                        partial=(method == "PATCH"),
                        context={"request": request},
                    )
                    if "animal_id" in serializer.fields:
                        serializer.fields["animal_id"].queryset = Animal.objects.filter(farm=farm)
                    if "medication_id" in serializer.fields:
                        serializer.fields["medication_id"].queryset = Medication.objects.filter(
                            farm=farm,
                        )
                    serializer.is_valid(raise_exception=True)
                    save_kwargs = {}
                    if resource == "animals" or resource in {
                        "vaccines", "medications", "inputs", "equipment",
                        "crops", "fish-farming", "farm-settings", "module-themes",
                    }:
                        save_kwargs["farm"] = farm
                    if resource == "milk-production" and instance is None:
                        save_kwargs["registered_by"] = profile
                    if resource == "daily-activities":
                        save_kwargs["farm"] = farm
                        if instance is None:
                            save_kwargs["worker"] = profile
                    if resource == "disease-reports":
                        save_kwargs.update(farm=farm, reported_by=profile)
                    if resource == "vaccines":
                        from finca.models import Vaccine
                        previous_status = instance.status if instance else Vaccine.Status.PENDING
                        next_status = serializer.validated_data.get("status", previous_status)
                        if next_status == Vaccine.Status.APPLIED and (
                            previous_status != Vaccine.Status.APPLIED or not instance.applied_by_id
                        ):
                            save_kwargs["applied_by"] = profile
                        elif next_status != Vaccine.Status.APPLIED:
                            save_kwargs["applied_by"] = None
                    if resource in {"farm-settings", "module-themes"}:
                        save_kwargs["updated_by"] = profile
                    if instance is None:
                        save_kwargs["id"] = operation_id
                    saved = serializer.save(**save_kwargs)
                    if resource == "daily-activities":
                        record_activity_submission(
                            saved,
                            profile,
                            ActivitySubmission.Action.CREATED
                            if instance is None
                            else ActivitySubmission.Action.UPDATED,
                        )
                    result = {
                        "id": str(operation_id),
                        "status": "applied",
                        "data": serialize_activity(saved)
                        if resource == "daily-activities"
                        else serializer_class(saved).data,
                    }
                result = json.loads(json.dumps(result, cls=DjangoJSONEncoder))
                SyncOperation.objects.create(
                    user=request.user,
                    farm=farm,
                    operation_id=operation_id,
                    result=result,
                )
                return result
        except model.DoesNotExist:
            return {"id": str(operation_id), "status": "rejected", "error": "El registro ya no existe o no pertenece a esta finca."}
        except serializers.ValidationError as error:
            error_message = (
                "La chapeta ICA ya está registrada en esta finca. Elige otra chapeta para guardar el animal."
                if resource == "animals" and "chapeta ICA ya está registrada" in str(error.detail)
                else error.detail
            )
            return {"id": str(operation_id), "status": "rejected", "error": error_message}
        except IntegrityError as error:
            receipt = SyncOperation.objects.filter(user=request.user, operation_id=operation_id).first()
            if receipt and receipt.farm_id == farm.pk:
                return {**receipt.result, "status": "applied", "replayed": True}
            database_error = error.__cause__
            diagnostics = getattr(database_error, "diag", None)
            constraint_name = getattr(diagnostics, "constraint_name", None)
            logger.error(
                "Offline sync integrity error: operation=%s resource=%s method=%s "
                "constraint=%r table=%r column=%r sqlstate=%r message=%r",
                operation_id,
                resource,
                method,
                constraint_name,
                getattr(diagnostics, "table_name", None),
                getattr(diagnostics, "column_name", None),
                getattr(database_error, "sqlstate", None),
                getattr(diagnostics, "message_primary", None),
            )
            if (
                resource == "animals"
                and (
                    "ica_code" in (constraint_name or "").lower()
                    or getattr(diagnostics, "column_name", None) == "ica_code"
                    or "animal_farm_ica_code_uniq" in str(error)
                    or ("animals.farm_id" in str(error) and "animals.ica_code" in str(error))
                )
            ):
                return {
                    "id": str(operation_id),
                    "status": "rejected",
                    "error": "La chapeta ICA ya está registrada en esta finca. Corrígela y vuelve a sincronizar.",
                }
            return {"id": str(operation_id), "status": "rejected", "error": "La operación no pudo aplicarse por una restricción de datos."}

    @classmethod
    def normalize(cls, value):
        if isinstance(value, dict):
            return {key: cls.normalize(item) for key, item in sorted(value.items())}
        if isinstance(value, list):
            return [cls.normalize(item) for item in value]
        return value

    @classmethod
    def contains_sensitive_field(cls, value):
        if isinstance(value, dict):
            return any(
                re.search(r"password|credential|secret", str(key), re.IGNORECASE)
                or cls.contains_sensitive_field(item)
                for key, item in value.items()
            )
        if isinstance(value, list):
            return any(cls.contains_sensitive_field(item) for item in value)
        return False
