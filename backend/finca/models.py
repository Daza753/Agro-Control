import uuid
from datetime import date

from django.conf import settings
from django.db import models

from accounts.models import Farm, Profile


class Animal(models.Model):
    class Species(models.TextChoices):
        BOVINE = "bovino", "Bovino"
        EQUINE = "equino", "Equino"
        PORCINE = "porcino", "Porcino"
        CAPRINE = "caprino", "Caprino"
        OVINE = "ovino", "Ovino"
        OTHER = "otro", "Otro"
        LEGACY_COW = "vaca", "Vaca (antiguo)"
        LEGACY_BULL = "toro", "Toro (antiguo)"
        LEGACY_CALF = "ternero", "Ternero (antiguo)"
        LEGACY_HORSE = "caballo", "Caballo (antiguo)"
        LEGACY_PIG = "cerdo", "Cerdo (antiguo)"
        LEGACY_GOAT = "chivo", "Chivo (antiguo)"
        LEGACY_SHEEP = "oveja", "Oveja (antiguo)"

    class Sex(models.TextChoices):
        MALE = "macho", "Macho"
        FEMALE = "hembra", "Hembra"

    class HealthStatus(models.TextChoices):
        HEALTHY = "sano", "Sano"
        SICK = "enfermo", "Enfermo"
        TREATMENT = "en_tratamiento", "En tratamiento"
        DECEASED = "fallecido", "Fallecido"

    class LactationStatus(models.TextChoices):
        FILLING = "llenando", "Llenando"
        CALVED = "parida", "Parida"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="animals")
    ica_code = models.CharField(max_length=100)
    name = models.CharField(max_length=200, blank=True, default="")
    species = models.CharField(max_length=20, choices=Species.choices)
    category = models.CharField(max_length=40, blank=True, default="")
    breed = models.CharField(max_length=120, blank=True, default="")
    sex = models.CharField(max_length=10, choices=Sex.choices)
    birth_date = models.DateField(null=True, blank=True)
    weight_kg = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    health_status = models.CharField(
        max_length=20, choices=HealthStatus.choices, default=HealthStatus.HEALTHY
    )
    photo_url = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    active = models.BooleanField(default=True)
    lactation_status = models.CharField(
        max_length=20, choices=LactationStatus.choices, null=True, blank=True
    )
    ref_number = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "animals"
        ordering = ["ica_code"]
        indexes = [
            models.Index(fields=["species"], name="animal_species_idx"),
            models.Index(fields=["active"], name="animal_active_idx"),
        ]
        constraints = [
            models.UniqueConstraint(fields=["farm", "ica_code"], name="animal_farm_ica_code_uniq"),
            models.CheckConstraint(
                condition=models.Q(species__in=[
                    "bovino", "equino", "porcino", "caprino", "ovino", "otro",
                    "vaca", "toro", "ternero", "caballo", "cerdo", "chivo", "oveja",
                ]),
                name="animal_species_valid",
            ),
        ]

    def __str__(self):
        return self.ica_code


class MilkProduction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name="milk_records")
    date = models.DateField(default=date.today)
    morning_liters = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    afternoon_liters = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    registered_by = models.ForeignKey(
        Profile,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="registered_milk_records",
        db_column="registered_by",
    )
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "milk_production"
        ordering = ["-date", "-created_at"]
        indexes = [
            models.Index(fields=["date"], name="milk_date_idx"),
            models.Index(fields=["animal"], name="milk_animal_idx"),
        ]

    @property
    def total_liters(self):
        return self.morning_liters + self.afternoon_liters


class Vaccine(models.Model):
    class Status(models.TextChoices):
        PENDING = "pendiente", "Pendiente"
        APPLIED = "aplicada", "Aplicada"
        EXPIRED = "vencida", "Vencida"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="vaccines")
    animal = models.ForeignKey(
        Animal, null=True, blank=True, on_delete=models.CASCADE, related_name="vaccines"
    )
    vaccine_name = models.CharField(max_length=200)
    medication_item = models.ForeignKey(
        "Medication",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="vaccine_records",
    )
    scheduled_date = models.DateField()
    applied_date = models.DateField(null=True, blank=True)
    medication = models.CharField(max_length=200, null=True, blank=True)
    dose = models.CharField(max_length=100, null=True, blank=True)
    applied_by = models.ForeignKey(
        Profile,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="applied_vaccines",
        db_column="applied_by",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "vaccines"
        ordering = ["scheduled_date"]
        indexes = [
            models.Index(fields=["status"], name="vaccine_status_idx"),
            models.Index(fields=["scheduled_date"], name="vaccine_date_idx"),
        ]


class Medication(models.Model):
    class Type(models.TextChoices):
        ANTIBIOTIC = "antibiotico", "Antibiótico"
        VITAMIN = "vitamina", "Vitamina"
        DEWORMER = "desparasitante", "Desparasitante"
        ANTIPARASITIC = "antiparasitario", "Antiparasitario"
        OTHER = "otro", "Otro"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="medications")
    name = models.CharField(max_length=200)
    type = models.CharField(max_length=30, choices=Type.choices)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unit = models.CharField(max_length=40, default="ml")
    dose = models.CharField(max_length=100, null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    supplier = models.CharField(max_length=200, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "medications"
        ordering = ["name"]


class Input(models.Model):
    class Type(models.TextChoices):
        FERTILIZER = "fertilizante", "Fertilizante"
        HERBICIDE = "herbicida", "Herbicida"
        INSECTICIDE = "insecticida", "Insecticida"
        POISON = "veneno", "Veneno"
        SEED = "semilla", "Semilla"
        OTHER = "otro", "Otro"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="inputs")
    name = models.CharField(max_length=200)
    type = models.CharField(max_length=30, choices=Type.choices)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unit = models.CharField(max_length=40, default="kg")
    supplier = models.CharField(max_length=200, null=True, blank=True)
    purchase_date = models.DateField(null=True, blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inputs"
        ordering = ["name"]


class Equipment(models.Model):
    class Type(models.TextChoices):
        CHAINSAW = "motosierra", "Motosierra"
        BRUSH_CUTTER = "guadana", "Guadaña"
        SPRAYER = "bomba_fumigadora", "Bomba fumigadora"
        TRACTOR = "tractor", "Tractor"
        HAND_TOOL = "herramienta_manual", "Herramienta manual"
        OTHER = "otro", "Otro"

    class Status(models.TextChoices):
        GOOD = "bueno", "Bueno"
        FAIR = "regular", "Regular"
        BAD = "malo", "Malo"
        REPAIR = "en_reparacion", "En reparación"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="equipment")
    name = models.CharField(max_length=200)
    type = models.CharField(max_length=40, choices=Type.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.GOOD)
    last_maintenance_date = models.DateField(null=True, blank=True)
    next_maintenance_date = models.DateField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "equipment"
        ordering = ["name"]


class Crop(models.Model):
    class Type(models.TextChoices):
        CORN = "maiz", "Maíz"
        CASSAVA = "yuca", "Yuca"
        BEAN = "frijol", "Fríjol"
        GRASS = "pasto", "Pasto"
        OTHER = "otro", "Otro"

    class Status(models.TextChoices):
        ACTIVE = "activo", "Activo"
        HARVESTED = "cosechado", "Cosechado"
        LOST = "perdido", "Perdido"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="crops")
    name = models.CharField(max_length=200)
    type = models.CharField(max_length=20, choices=Type.choices)
    area_hectares = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    planting_date = models.DateField(null=True, blank=True)
    expected_harvest_date = models.DateField(null=True, blank=True)
    harvest_date = models.DateField(null=True, blank=True)
    fertilization_notes = models.TextField(null=True, blank=True)
    production_kg = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "crops"
        ordering = ["name"]


class FishPond(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "activo", "Activo"
        HARVESTED = "cosechado", "Cosechado"
        INACTIVE = "inactivo", "Inactivo"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="fish_ponds")
    pond_name = models.CharField(max_length=200)
    species = models.CharField(max_length=100)
    quantity = models.PositiveIntegerField(default=0)
    avg_weight_kg = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    feeding_notes = models.TextField(null=True, blank=True)
    mortality = models.PositiveIntegerField(default=0)
    production_kg = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fish_farming"
        ordering = ["pond_name"]


class DailyActivity(models.Model):
    class Type(models.TextChoices):
        MILKING = "ordeno", "Ordeño"
        FEEDING = "alimentacion", "Alimentación"
        BIRTH = "nacimiento", "Nacimiento"
        ANIMAL_CHECK = "consulta_animal", "Consulta de animal"
        DISEASE = "reporte_enfermedad", "Reporte de enfermedad"
        OTHER = "otro", "Otro"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="daily_activities")
    worker = models.ForeignKey(
        Profile,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="daily_activities",
    )
    date = models.DateField(default=date.today)
    activity_type = models.CharField(max_length=30, choices=Type.choices)
    description = models.TextField()
    animal = models.ForeignKey(
        Animal, null=True, blank=True, on_delete=models.SET_NULL, related_name="activities"
    )
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "daily_activities"
        ordering = ["-date", "-created_at"]
        indexes = [models.Index(fields=["date"], name="activity_date_idx")]


class DiseaseReport(models.Model):
    class Status(models.TextChoices):
        OPEN = "abierto", "Abierto"
        TREATMENT = "en_tratamiento", "En tratamiento"
        RESOLVED = "resuelto", "Resuelto"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="disease_reports")
    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name="disease_reports")
    reported_by = models.ForeignKey(
        Profile,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reported_diseases",
        db_column="reported_by",
    )
    report_date = models.DateField(default=date.today)
    symptoms = models.TextField()
    diagnosis = models.TextField(null=True, blank=True)
    treatment = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "disease_reports"
        ordering = ["-report_date", "-created_at"]


class FarmSettings(models.Model):
    class BackgroundMode(models.TextChoices):
        LIGHT = "light", "Claro"
        DARK = "dark", "Oscuro"

    class SidebarStyle(models.TextChoices):
        DARK = "dark", "Oscuro"
        LIGHT = "light", "Claro"

    class HeaderStyle(models.TextChoices):
        DARK = "dark", "Oscuro"
        LIGHT = "light", "Claro"
        TRANSPARENT = "transparent", "Transparente"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farm = models.ForeignKey(Farm, null=True, blank=True, on_delete=models.CASCADE, related_name="settings")
    farm_name = models.CharField(max_length=200, default="Mi Finca")
    logo_url = models.TextField(null=True, blank=True)
    primary_color = models.CharField(max_length=20, default="#059669")
    secondary_color = models.CharField(max_length=20, default="#0f172a")
    accent_color = models.CharField(max_length=20, default="#10b981")
    background_mode = models.CharField(
        max_length=10, choices=BackgroundMode.choices, default=BackgroundMode.LIGHT
    )
    sidebar_style = models.CharField(
        max_length=10, choices=SidebarStyle.choices, default=SidebarStyle.DARK
    )
    header_style = models.CharField(
        max_length=15, choices=HeaderStyle.choices, default=HeaderStyle.LIGHT
    )
    show_footer = models.BooleanField(default=True)
    footer_text = models.TextField(blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        Profile,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="updated_farm_settings",
        db_column="updated_by",
    )

    def __str__(self):
        return self.farm_name

    class Meta:
        db_table = "farm_settings"
        constraints = [
            models.UniqueConstraint(fields=["farm"], name="farm_settings_farm_uniq")
        ]


class ModuleTheme(models.Model):
    class Density(models.TextChoices):
        COMPACT = "compact", "Compacta"
        NORMAL = "normal", "Normal"
        COMFORTABLE = "comfortable", "Cómoda"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farm = models.ForeignKey(Farm, null=True, blank=True, on_delete=models.CASCADE, related_name="module_themes")
    module_key = models.CharField(max_length=80)
    card_radius = models.CharField(max_length=30, default="1rem")
    card_padding = models.CharField(max_length=30, default="1.5rem")
    card_border_color = models.CharField(max_length=30, default="#e2e8f0")
    card_bg_color = models.CharField(max_length=30, default="#ffffff")
    card_shadow = models.CharField(max_length=30, default="sm")
    grid_columns = models.CharField(max_length=10, default="4")
    grid_gap = models.CharField(max_length=30, default="1rem")
    heading_size = models.CharField(max_length=30, default="1.5rem")
    heading_color = models.CharField(max_length=30, default="#1e293b")
    body_text_size = models.CharField(max_length=30, default="0.875rem")
    body_text_color = models.CharField(max_length=30, default="#64748b")
    accent_color = models.CharField(max_length=30, default="#059669")
    table_header_bg = models.CharField(max_length=30, default="#f8fafc")
    table_row_hover_bg = models.CharField(max_length=30, default="#f8fafc")
    density = models.CharField(max_length=20, choices=Density.choices, default=Density.NORMAL)
    layout_config = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        Profile,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="updated_module_themes",
        db_column="updated_by",
    )

    def __str__(self):
        return self.module_key

    class Meta:
        db_table = "module_themes"
        constraints = [
            models.UniqueConstraint(
                fields=["farm", "module_key"], name="module_theme_farm_key_uniq"
            )
        ]


class AnimalCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=40)
    label = models.CharField(max_length=120)
    species = models.CharField(max_length=30, default="all")
    color = models.CharField(max_length=20, default="#64748b")
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "animal_categories"
        constraints = [
            models.UniqueConstraint(
                fields=["code", "species"], name="animal_category_code_species_uniq"
            )
        ]
        ordering = ["label"]

    def __str__(self):
        return self.label


class SyncOperation(models.Model):
    """Idempotency receipt for an offline mutation submitted by one user."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE)
    operation_id = models.UUIDField()
    result = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "sync_operations"
        constraints = [
            models.UniqueConstraint(
                fields=("user", "operation_id"), name="sync_user_operation_uniq"
            )
        ]


class ActivitySubmission(models.Model):
    class Action(models.TextChoices):
        CREATED = "created", "Creado"
        UPDATED = "updated", "Editado"
        DELETED = "deleted", "Eliminado"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="activity_submissions")
    activity = models.ForeignKey(
        DailyActivity,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="submissions",
    )
    submitted_by = models.ForeignKey(
        Profile,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="activity_submissions",
    )
    action = models.CharField(max_length=10, choices=Action.choices)
    data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "activity_submissions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["farm", "created_at"], name="activity_submission_farm_idx"),
            models.Index(fields=["submitted_by", "created_at"], name="activity_submission_user_idx"),
        ]
