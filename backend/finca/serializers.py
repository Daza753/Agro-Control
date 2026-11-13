import re

from rest_framework import serializers

from accounts.farm_access import get_request_farm
from accounts.models import ModuleAccess
from finca.models import (
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


class AnimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Animal
        fields = (
            "id",
            "ica_code",
            "name",
            "species",
            "category",
            "breed",
            "sex",
            "birth_date",
            "weight_kg",
            "health_status",
            "photo_url",
            "notes",
            "active",
            "lactation_status",
            "ref_number",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_ica_code(self, value):
        request = self.context.get("request")
        if request is None:
            return value

        duplicates = Animal.objects.filter(
            farm=get_request_farm(request),
            ica_code=value,
        )
        if self.instance is not None:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError(
                "La chapeta ICA ya está registrada en esta finca. Usa una chapeta distinta."
            )
        return value

    def validate(self, attrs):
        species = attrs.get("species", getattr(self.instance, "species", None))
        sex = attrs.get("sex", getattr(self.instance, "sex", None))
        lactation_status = attrs.get(
            "lactation_status",
            getattr(self.instance, "lactation_status", None),
        )
        bovine_species = {
            Animal.Species.BOVINE,
            Animal.Species.LEGACY_COW,
            Animal.Species.LEGACY_BULL,
            Animal.Species.LEGACY_CALF,
        }
        if lactation_status and (species not in bovine_species or sex != Animal.Sex.FEMALE):
            raise serializers.ValidationError(
                {"lactation_status": "El estado de lactación solo aplica a bovinos hembra."}
            )
        return attrs


class AnimalCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AnimalCategory
        fields = ("id", "code", "label", "species", "color", "is_default", "created_at")
        read_only_fields = ("id", "is_default", "created_at")


class MilkProductionAnimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Animal
        fields = ("id", "name", "ica_code", "category", "species", "sex", "notes", "breed")


class MilkProductionSerializer(serializers.ModelSerializer):
    animal = MilkProductionAnimalSerializer(read_only=True)
    animal_id = serializers.PrimaryKeyRelatedField(
        source="animal",
        queryset=Animal.objects.all(),
        write_only=True,
    )
    total_liters = serializers.DecimalField(
        max_digits=7,
        decimal_places=2,
        read_only=True,
    )
    registered_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = MilkProduction
        fields = (
            "id",
            "animal",
            "animal_id",
            "date",
            "morning_liters",
            "afternoon_liters",
            "total_liters",
            "registered_by",
            "notes",
            "created_at",
        )
        read_only_fields = ("id", "registered_by", "created_at", "total_liters")

    def validate(self, attrs):
        animal = attrs.get("animal", getattr(self.instance, "animal", None))
        is_bovine = animal and animal.species in {
            Animal.Species.BOVINE,
            Animal.Species.LEGACY_COW,
            Animal.Species.LEGACY_BULL,
            Animal.Species.LEGACY_CALF,
        }
        is_lactating = animal and animal.lactation_status == Animal.LactationStatus.CALVED
        is_lechera_category = animal and animal.category and AnimalCategory.objects.filter(
            code=animal.category,
            species__in=("bovino", "all"),
            label__icontains="lechera",
        ).exists()
        if animal and (
            not is_bovine
            or animal.sex != Animal.Sex.FEMALE
            or not animal.active
            or not (is_lactating or is_lechera_category)
        ):
            raise serializers.ValidationError(
                {"animal_id": "Selecciona una hembra bovina activa, parida o de categoría Lechera."}
            )
        return attrs


class VaccineSerializer(serializers.ModelSerializer):
    animal = MilkProductionAnimalSerializer(read_only=True)
    animal_id = serializers.PrimaryKeyRelatedField(
        source="animal", queryset=Animal.objects.all(), allow_null=True, required=False
    )
    medication_id = serializers.PrimaryKeyRelatedField(
        source="medication_item",
        queryset=Medication.objects.all(),
        allow_null=True,
        required=False,
    )
    applied_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Vaccine
        fields = (
            "id", "animal", "animal_id", "vaccine_name", "scheduled_date",
            "applied_date", "medication", "medication_id", "dose", "applied_by", "status",
            "notes", "created_at",
        )
        read_only_fields = ("id", "applied_by", "created_at")

    def validate(self, attrs):
        medication = attrs.get("medication_item")
        request = self.context.get("request")
        if medication and request and medication.farm_id != get_request_farm(request).pk:
            raise serializers.ValidationError(
                {"medication_id": "El medicamento seleccionado no pertenece a esta finca."}
            )
        if "medication_item" in attrs:
            attrs["medication"] = medication.name if medication else None
        elif "medication" in attrs and request:
            medication_name = (attrs["medication"] or "").strip()
            matches = list(
                Medication.objects.filter(
                    farm=get_request_farm(request),
                    name__iexact=medication_name,
                )[:2]
            ) if medication_name else []
            attrs["medication_item"] = matches[0] if len(matches) == 1 else None
        return attrs


class DailyActivitySerializer(serializers.ModelSerializer):
    animal = MilkProductionAnimalSerializer(read_only=True)
    animal_id = serializers.PrimaryKeyRelatedField(
        source="animal", queryset=Animal.objects.all(), allow_null=True, required=False
    )
    worker = serializers.SerializerMethodField()
    worker_id = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = DailyActivity
        fields = (
            "id", "worker", "worker_id", "date", "activity_type", "description",
            "animal", "animal_id", "notes", "created_at",
        )
        read_only_fields = ("id", "worker", "worker_id", "created_at")

    def get_worker(self, activity):
        if not activity.worker:
            return None
        return {"id": str(activity.worker_id), "full_name": activity.worker.full_name}


class DiseaseReportSerializer(serializers.ModelSerializer):
    animal = MilkProductionAnimalSerializer(read_only=True)
    animal_id = serializers.PrimaryKeyRelatedField(
        source="animal", queryset=Animal.objects.all()
    )
    reported_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = DiseaseReport
        fields = (
            "id", "animal", "animal_id", "reported_by", "report_date", "symptoms",
            "diagnosis", "treatment", "status", "notes", "created_at", "updated_at",
        )
        read_only_fields = ("id", "reported_by", "created_at", "updated_at")


class MedicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medication
        fields = "__all__"
        read_only_fields = ("id", "farm", "created_at", "updated_at")


class InputSerializer(serializers.ModelSerializer):
    class Meta:
        model = Input
        fields = "__all__"
        read_only_fields = ("id", "farm", "created_at", "updated_at")


class EquipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Equipment
        fields = "__all__"
        read_only_fields = ("id", "farm", "created_at", "updated_at")


class CropSerializer(serializers.ModelSerializer):
    class Meta:
        model = Crop
        fields = "__all__"
        read_only_fields = ("id", "farm", "created_at", "updated_at")


class FishPondSerializer(serializers.ModelSerializer):
    class Meta:
        model = FishPond
        fields = "__all__"
        read_only_fields = ("id", "farm", "created_at", "updated_at")


class ModuleAccessSerializer(serializers.ModelSerializer):
    updated_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ModuleAccess
        fields = "__all__"
        read_only_fields = ("id", "farm", "updated_at", "updated_by")


class ModuleThemeSerializer(serializers.ModelSerializer):
    updated_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ModuleTheme
        fields = "__all__"
        read_only_fields = ("id", "farm", "updated_at", "updated_by")

    def validate_layout_config(self, value):
        if not isinstance(value, dict) or set(value) != {"version", "items"}:
            raise serializers.ValidationError(
                "La configuración debe incluir únicamente la versión y la lista de bloques."
            )
        if type(value["version"]) is not int or value["version"] != 1:
            raise serializers.ValidationError("La versión de diseño no es compatible.")

        items = value["items"]
        if not isinstance(items, list) or not 1 <= len(items) <= 30:
            raise serializers.ValidationError("El diseño debe incluir entre 1 y 30 bloques.")

        allowed_types = {
            "module-content", "metric", "chart", "table", "calendar",
            "list", "status", "filters", "heading", "image", "summary",
            "activity", "map", "shortcut", "form",
        }
        expected_fields = {
            "id", "type", "title", "body", "width", "height",
            "background_color", "heading_color", "text_color",
            "font_family", "heading_size", "body_size", "border_radius",
        }
        allowed_widths = {4, 6, 8, 12}
        allowed_heights = {"compact", "normal", "tall"}
        allowed_fonts = {"Inter", "Arial", "Georgia", "Verdana"}
        allowed_radii = {"0rem", "0.5rem", "1rem", "1.5rem"}
        colors = {"background_color", "heading_color", "text_color"}
        identifiers = set()
        content_count = 0

        for index, item in enumerate(items):
            if not isinstance(item, dict) or set(item) != expected_fields:
                raise serializers.ValidationError(
                    f"El bloque {index + 1} no tiene la estructura esperada."
                )
            item_id = item["id"]
            if (
                not isinstance(item_id, str)
                or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,79}", item_id)
                or item_id in identifiers
            ):
                raise serializers.ValidationError(
                    f"El identificador del bloque {index + 1} no es válido o está repetido."
                )
            identifiers.add(item_id)

            if not isinstance(item["type"], str) or item["type"] not in allowed_types:
                raise serializers.ValidationError(
                    f"El tipo del bloque {index + 1} no está permitido."
                )
            if item["type"] == "module-content":
                content_count += 1
                if item["width"] != 12:
                    raise serializers.ValidationError(
                        "El contenido funcional debe conservar el ancho completo."
                    )

            if not isinstance(item["title"], str) or not item["title"].strip() or len(item["title"]) > 80:
                raise serializers.ValidationError(
                    f"El título del bloque {index + 1} debe tener entre 1 y 80 caracteres."
                )
            if not isinstance(item["body"], str) or len(item["body"]) > 500:
                raise serializers.ValidationError(
                    f"El texto del bloque {index + 1} no puede superar 500 caracteres."
                )
            if type(item["width"]) is not int or item["width"] not in allowed_widths:
                raise serializers.ValidationError(
                    f"El ancho del bloque {index + 1} no es válido."
                )
            if not isinstance(item["height"], str) or item["height"] not in allowed_heights:
                raise serializers.ValidationError(
                    f"El tamaño del bloque {index + 1} no es válido."
                )
            if not isinstance(item["font_family"], str) or item["font_family"] not in allowed_fonts:
                raise serializers.ValidationError(
                    f"La tipografía del bloque {index + 1} no está permitida."
                )
            if type(item["heading_size"]) is not int or not 12 <= item["heading_size"] <= 32:
                raise serializers.ValidationError(
                    f"El tamaño del título del bloque {index + 1} no es válido."
                )
            if type(item["body_size"]) is not int or not 10 <= item["body_size"] <= 20:
                raise serializers.ValidationError(
                    f"El tamaño del texto del bloque {index + 1} no es válido."
                )
            if not isinstance(item["border_radius"], str) or item["border_radius"] not in allowed_radii:
                raise serializers.ValidationError(
                    f"La forma del bloque {index + 1} no es válida."
                )
            for field in colors:
                color = item[field]
                if not isinstance(color, str) or (
                    color and not re.fullmatch(r"#[0-9A-Fa-f]{6}", color)
                ):
                    raise serializers.ValidationError(
                        f"El color {field} del bloque {index + 1} no es válido."
                    )

        if content_count != 1:
            raise serializers.ValidationError(
                "El diseño debe conservar un único bloque de contenido funcional."
            )
        return value


class FarmSettingsSerializer(serializers.ModelSerializer):
    updated_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = FarmSettings
        fields = "__all__"
        read_only_fields = ("id", "farm", "updated_at", "updated_by")
