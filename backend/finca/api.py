from django.core.paginator import Paginator
from django.db import transaction
from django.utils.dateparse import parse_date
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from django.db.models import Q
from accounts.farm_access import get_request_farm
from accounts.models import ModuleAccess, Profile
from finca.activity_submissions import (
    record_activity_submission,
    record_deleted_activity_submission,
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


class IsActiveAdmin(permissions.BasePermission):
    message = "Solo un administrador activo puede modificar categorías."

    def has_permission(self, request, view):
        user = request.user
        return (
            user.is_authenticated
            and user.is_active
            and hasattr(user, "profile")
            and user.profile.active
            and user.profile.role == "admin"
        )


class ActiveProfilePermission(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.is_active
            and hasattr(request.user, "profile")
            and request.user.profile.active
        )


class ModuleEnabledPermission(permissions.BasePermission):
    message = "Este módulo no está habilitado para tu perfil."

    def has_permission(self, request, view):
        module_key = getattr(view, "module_key", None)
        if not module_key or request.user.profile.role == Profile.Role.ADMIN:
            return True
        farm = get_request_farm(request)
        module_access = ModuleAccess.objects.filter(module_key=module_key).only(
            "enabled_for_workers"
        ).filter(farm=farm).first()
        return module_access is None or module_access.enabled_for_workers


class AnimalViewSet(viewsets.ModelViewSet):
    serializer_class = AnimalSerializer
    permission_classes = [ActiveProfilePermission, ModuleEnabledPermission]
    module_key = "animals"
    queryset = Animal.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset().filter(farm=get_request_farm(self.request))
        species = self.request.query_params.get("species")
        if species and species != "all":
            if species not in Animal.Species.values:
                raise ValidationError({"species": "Especie no válida."})
            species_aliases = {
                Animal.Species.BOVINE: (
                    Animal.Species.BOVINE,
                    Animal.Species.LEGACY_COW,
                    Animal.Species.LEGACY_BULL,
                    Animal.Species.LEGACY_CALF,
                ),
                Animal.Species.EQUINE: (Animal.Species.EQUINE, Animal.Species.LEGACY_HORSE),
                Animal.Species.PORCINE: (Animal.Species.PORCINE, Animal.Species.LEGACY_PIG),
                Animal.Species.CAPRINE: (Animal.Species.CAPRINE, Animal.Species.LEGACY_GOAT),
                Animal.Species.OVINE: (Animal.Species.OVINE, Animal.Species.LEGACY_SHEEP),
            }
            queryset = queryset.filter(species__in=species_aliases.get(species, (species,)))

        search = self.request.query_params.get("search", "").strip()
        if search:
            if len(search) > 100:
                raise ValidationError({"search": "La búsqueda no puede superar 100 caracteres."})
            queryset = queryset.filter(Q(ica_code__icontains=search) | Q(breed__icontains=search))

        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category)

        active = self.request.query_params.get("active")
        if active is not None:
            if active not in {"true", "false"}:
                raise ValidationError({"active": "Usa true o false."})
            queryset = queryset.filter(active=(active == "true"))

        return queryset.order_by("ica_code")

    def perform_create(self, serializer):
        serializer.save(farm=get_request_farm(self.request))


class AnimalCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = AnimalCategorySerializer
    queryset = AnimalCategory.objects.all()
    permission_classes = [ActiveProfilePermission, ModuleEnabledPermission]
    module_key = "animals"
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [ActiveProfilePermission(), ModuleEnabledPermission()]
        return [ActiveProfilePermission(), IsActiveAdmin(), ModuleEnabledPermission()]

    def perform_destroy(self, instance):
        if instance.is_default:
            raise ValidationError("Las categorías por defecto no se pueden eliminar.")
        instance.delete()


class MilkProductionViewSet(viewsets.ModelViewSet):
    serializer_class = MilkProductionSerializer
    permission_classes = [ActiveProfilePermission, ModuleEnabledPermission]
    module_key = "milk"
    queryset = MilkProduction.objects.select_related("animal", "registered_by").all()

    def get_queryset(self):
        queryset = super().get_queryset().filter(
            animal__farm=get_request_farm(self.request)
        )
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            queryset = queryset.filter(date__gte=self._parse_date("date_from", date_from))
        if date_to:
            queryset = queryset.filter(date__lte=self._parse_date("date_to", date_to))

        search = self.request.query_params.get("search", "").strip()
        if search:
            if len(search) > 100:
                raise ValidationError({"search": "La búsqueda no puede superar 100 caracteres."})
            queryset = queryset.filter(animal__ica_code__icontains=search)
        return queryset.order_by("-date", "-created_at")

    def get_serializer(self, *args, **kwargs):
        serializer = super().get_serializer(*args, **kwargs)
        base_serializer = serializer.child if hasattr(serializer, "child") else serializer
        base_serializer.fields["animal_id"].queryset = Animal.objects.filter(
            farm=get_request_farm(self.request)
        )
        return serializer

    def _parse_date(self, parameter, value):
        from django.utils.dateparse import parse_date

        parsed = parse_date(value)
        if parsed is None:
            raise ValidationError({parameter: "Usa una fecha válida con formato AAAA-MM-DD."})
        return parsed

    def perform_create(self, serializer):
        serializer.save(registered_by=self.request.user.profile)


class ProtectedResourceViewSet(viewsets.ModelViewSet):
    permission_classes = [ActiveProfilePermission, ModuleEnabledPermission]
    filter_fields = ()
    search_fields = ()
    ordering_fields = ()
    default_ordering = ("id",)
    max_list_items = 500

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())[:self.max_list_items]
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def get_serializer(self, *args, **kwargs):
        serializer = super().get_serializer(*args, **kwargs)
        base_serializer = serializer.child if hasattr(serializer, "child") else serializer
        if "animal_id" in base_serializer.fields:
            base_serializer.fields["animal_id"].queryset = Animal.objects.filter(
                farm=get_request_farm(self.request)
            )
        return serializer

    def get_queryset(self):
        queryset = super().get_queryset().filter(farm=get_request_farm(self.request))
        for field in self.filter_fields:
            value = self.request.query_params.get(field)
            if value is not None:
                queryset = queryset.filter(**{field: value})

        search = self.request.query_params.get("search", "").strip()
        if search:
            if len(search) > 100 or not self.search_fields:
                raise ValidationError({"search": "Parámetro de búsqueda no válido."})
            search_query = Q()
            for field in self.search_fields:
                search_query |= Q(**{f"{field}__icontains": search})
            queryset = queryset.filter(search_query)

        ordering = self.request.query_params.get("ordering")
        if ordering:
            requested = ordering[1:] if ordering.startswith("-") else ordering
            invalid_ordering = (
                ordering.startswith("--")
                or not requested
                or requested not in self.ordering_fields
            )
            if invalid_ordering:
                raise ValidationError({"ordering": "Campo de ordenamiento no permitido."})
            queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by(*self.default_ordering)
        return queryset

    def perform_create(self, serializer):
        serializer.save(farm=get_request_farm(self.request))


class MedicationViewSet(ProtectedResourceViewSet):
    queryset = Medication.objects.all()
    serializer_class = MedicationSerializer
    filter_fields = ("type",)
    search_fields = ("name", "supplier", "type")
    ordering_fields = ("name", "created_at", "quantity", "expiry_date")
    default_ordering = ("-created_at",)
    module_key = "medications"


class InputViewSet(ProtectedResourceViewSet):
    queryset = Input.objects.all()
    serializer_class = InputSerializer
    filter_fields = ("type",)
    search_fields = ("name", "supplier", "type")
    ordering_fields = ("name", "created_at", "purchase_date", "quantity")
    default_ordering = ("-created_at",)
    module_key = "inputs"


class EquipmentViewSet(ProtectedResourceViewSet):
    queryset = Equipment.objects.all()
    serializer_class = EquipmentSerializer
    filter_fields = ("status",)
    search_fields = ("name", "type")
    ordering_fields = ("name", "created_at", "status")
    default_ordering = ("-created_at",)
    module_key = "equipment"


class CropViewSet(ProtectedResourceViewSet):
    queryset = Crop.objects.all()
    serializer_class = CropSerializer
    filter_fields = ("status",)
    search_fields = ("name", "type")
    ordering_fields = ("name", "created_at", "status")
    default_ordering = ("-created_at",)
    module_key = "crops"


class FishPondViewSet(ProtectedResourceViewSet):
    queryset = FishPond.objects.all()
    serializer_class = FishPondSerializer
    filter_fields = ("status",)
    search_fields = ("pond_name", "species")
    ordering_fields = ("pond_name", "created_at", "status")
    default_ordering = ("-created_at",)
    module_key = "fish"


class VaccineViewSet(ProtectedResourceViewSet):
    queryset = Vaccine.objects.select_related("animal", "applied_by").all()
    serializer_class = VaccineSerializer
    filter_fields = ("status", "scheduled_date")
    ordering_fields = ("scheduled_date", "created_at", "status")
    default_ordering = ("scheduled_date",)
    module_key = "vaccines"

    @action(detail=False, methods=["get"], url_path="medication-options")
    def medication_options(self, request):
        medications = Medication.objects.filter(
            farm=get_request_farm(request),
        ).order_by("name").values(
            "id",
            "name",
            "type",
            "quantity",
            "unit",
            "dose",
        )
        return Response(medications)

    def perform_create(self, serializer):
        is_applied = serializer.validated_data.get("status", Vaccine.Status.PENDING) == Vaccine.Status.APPLIED
        serializer.save(
            farm=get_request_farm(self.request),
            applied_by=self.request.user.profile if is_applied else None,
        )

    def perform_update(self, serializer):
        current_status = serializer.instance.status
        next_status = serializer.validated_data.get("status", current_status)
        if next_status == Vaccine.Status.APPLIED and (
            current_status != Vaccine.Status.APPLIED or not serializer.instance.applied_by_id
        ):
            serializer.save(applied_by=self.request.user.profile)
        elif next_status != Vaccine.Status.APPLIED:
            serializer.save(applied_by=None)
        else:
            serializer.save()


class DailyActivityViewSet(ProtectedResourceViewSet):
    queryset = DailyActivity.objects.select_related("animal", "worker").all()
    serializer_class = DailyActivitySerializer
    filter_fields = ("date", "activity_type")
    ordering_fields = ("date", "created_at")
    default_ordering = ("-date", "-created_at")
    module_key = "activities"
    max_list_items = 100

    def perform_create(self, serializer):
        with transaction.atomic():
            activity = serializer.save(
                worker=self.request.user.profile,
                farm=get_request_farm(self.request),
            )
            record_activity_submission(
                activity,
                self.request.user.profile,
                ActivitySubmission.Action.CREATED,
            )

    def perform_update(self, serializer):
        with transaction.atomic():
            activity = serializer.save(farm=get_request_farm(self.request))
            record_activity_submission(
                activity,
                self.request.user.profile,
                ActivitySubmission.Action.UPDATED,
            )

    def perform_destroy(self, instance):
        with transaction.atomic():
            record_deleted_activity_submission(instance, self.request.user.profile)
            instance.delete()


class WorkerActivityReportView(APIView):
    permission_classes = [ActiveProfilePermission, IsActiveAdmin]
    page_size = 50

    def get(self, request):
        farm = get_request_farm(request)
        queryset = ActivitySubmission.objects.filter(
            farm=farm,
            data__submitted_by__role=Profile.Role.WORKER,
        )

        worker_id = request.query_params.get("worker_id")
        if worker_id:
            if not Profile.objects.filter(
                pk=worker_id,
                farm=farm,
                role=Profile.Role.WORKER,
            ).exists():
                raise ValidationError({"worker_id": "El trabajador no pertenece a esta finca."})
            queryset = queryset.filter(data__submitted_by__id=worker_id)

        for parameter, lookup in (
            ("date_from", "created_at__date__gte"),
            ("date_to", "created_at__date__lte"),
        ):
            value = request.query_params.get(parameter)
            if value:
                parsed = parse_date(value)
                if parsed is None:
                    raise ValidationError({parameter: "Usa una fecha válida con formato AAAA-MM-DD."})
                queryset = queryset.filter(**{lookup: parsed})

        page_value = request.query_params.get("page", "1")
        try:
            page_number = int(page_value)
        except (TypeError, ValueError) as error:
            raise ValidationError({"page": "El número de página debe ser un entero positivo."}) from error
        if page_number < 1:
            raise ValidationError({"page": "El número de página debe ser un entero positivo."})

        page = Paginator(queryset.order_by("-created_at"), self.page_size).get_page(page_number)
        return Response({
            "count": page.paginator.count,
            "page": page.number,
            "page_size": self.page_size,
            "results": [
                {
                    "id": str(submission.pk),
                    "worker": submission.data["submitted_by"],
                    "action": submission.action,
                    "data": submission.data,
                    "created_at": submission.created_at,
                }
                for submission in page.object_list
            ],
        })


class DiseaseReportViewSet(ProtectedResourceViewSet):
    queryset = DiseaseReport.objects.select_related("animal", "reported_by").all()
    serializer_class = DiseaseReportSerializer
    filter_fields = ("status", "report_date")
    ordering_fields = ("report_date", "created_at", "status")
    default_ordering = ("-report_date", "-created_at")
    module_key = "diseases"

    def perform_create(self, serializer):
        serializer.save(reported_by=self.request.user.profile, farm=get_request_farm(self.request))

    def perform_update(self, serializer):
        serializer.save(reported_by=self.request.user.profile, farm=get_request_farm(self.request))


class ModuleThemeViewSet(ProtectedResourceViewSet):
    queryset = ModuleTheme.objects.all()
    serializer_class = ModuleThemeSerializer
    ordering_fields = ("module_key", "updated_at")
    default_ordering = ("module_key",)

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [ActiveProfilePermission()]
        return [ActiveProfilePermission(), IsActiveAdmin()]

    def perform_create(self, serializer):
        serializer.save(
            farm=get_request_farm(self.request),
            updated_by=self.request.user.profile,
        )

    def perform_update(self, serializer):
        serializer.save(
            farm=get_request_farm(self.request),
            updated_by=self.request.user.profile,
        )


class ModuleAccessViewSet(ProtectedResourceViewSet):
    queryset = ModuleAccess.objects.all()
    serializer_class = ModuleAccessSerializer
    ordering_fields = ("module_key",)
    default_ordering = ("module_key",)

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [ActiveProfilePermission()]
        return [ActiveProfilePermission(), IsActiveAdmin()]

    def perform_create(self, serializer):
        serializer.save(
            farm=get_request_farm(self.request),
            updated_by=self.request.user.profile,
        )

    def perform_update(self, serializer):
        serializer.save(
            farm=get_request_farm(self.request),
            updated_by=self.request.user.profile,
        )


class FarmSettingsViewSet(ProtectedResourceViewSet):
    queryset = FarmSettings.objects.all()
    serializer_class = FarmSettingsSerializer
    ordering_fields = ("updated_at",)
    default_ordering = ("-updated_at",)

    def get_queryset(self):
        return super().get_queryset().filter(farm=get_request_farm(self.request))

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [ActiveProfilePermission()]
        return [ActiveProfilePermission(), IsActiveAdmin()]

    def perform_create(self, serializer):
        raise ValidationError("La configuración de la finca ya existe.")

    def perform_update(self, serializer):
        settings = serializer.save(
            farm=get_request_farm(self.request),
            updated_by=self.request.user.profile,
        )
        if settings.farm.name != settings.farm_name:
            settings.farm.name = settings.farm_name
            settings.farm.save(update_fields=("name",))
