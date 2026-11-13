from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from finca.models import (
    ActivitySubmission,
    Animal,
    AnimalCategory,
    DailyActivity,
    FarmSettings,
    Medication,
    MilkProduction,
    ModuleTheme,
    Vaccine,
)
from accounts.models import ModuleAccess, User


class MilkProductionTests(TestCase):
    def test_total_liters_is_calculated_from_both_shifts(self):
        record = MilkProduction(morning_liters=Decimal("12.25"), afternoon_liters=Decimal("8.50"))

        self.assertEqual(record.total_liters, Decimal("20.75"))

    def test_initial_reference_data_is_seeded(self):
        self.assertEqual(ModuleAccess.objects.count(), 14)
        self.assertEqual(ModuleTheme.objects.count(), 14)
        self.assertEqual(AnimalCategory.objects.count(), 15)
        self.assertTrue(
            FarmSettings.objects.filter(
                id="00000000-0000-0000-0000-000000000001"
            ).exists()
        )
        self.assertEqual(
            set(
                AnimalCategory.objects.filter(
                    species="bovino",
                    is_default=True,
                ).values_list("code", flat=True)
            ),
            {"NV", "NO", "TR", "TE", "TT", "TO", "VA"},
        )
        self.assertEqual(
            list(
                AnimalCategory.objects.filter(
                    species="bovino",
                    is_default=True,
                ).order_by("label").values_list("label", "code")
            ),
            [
                ("Novilla", "NV"),
                ("Novillo", "NO"),
                ("Ternera", "TR"),
                ("Ternero", "TE"),
                ("Torete", "TT"),
                ("Toro", "TO"),
                ("Vaca", "VA"),
            ],
        )


class ModuleThemeApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            "theme-admin@farm.test",
            "Safe-test-password-513!",
        )
        self.client.force_authenticate(self.admin)
        self.client.credentials(HTTP_X_FARM_ID=str(self.admin.profile.farms.first().pk))

    def content_item(self):
        return {
            "id": "module-content",
            "type": "module-content",
            "title": "Contenido funcional del módulo",
            "body": "",
            "width": 12,
            "height": "normal",
            "background_color": "",
            "heading_color": "",
            "text_color": "",
            "font_family": "Inter",
            "heading_size": 18,
            "body_size": 14,
            "border_radius": "1rem",
        }

    def test_module_layout_config_is_persisted(self):
        layout_config = {"version": 1, "items": [self.content_item()]}

        response = self.client.post(
            "/api/module-themes/",
            {"module_key": "layout-test", "layout_config": layout_config},
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        theme = ModuleTheme.objects.get(pk=response.data["id"])
        self.assertEqual(theme.layout_config, layout_config)

    def test_module_layout_config_cannot_remove_functional_content(self):
        item = self.content_item()
        item.update({"id": "visual-block", "type": "metric"})

        response = self.client.post(
            "/api/module-themes/",
            {"module_key": "layout-test", "layout_config": {"version": 1, "items": [item]}},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(ModuleTheme.objects.filter(module_key="layout-test").exists())


class AnimalApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.worker = User.objects.create_user("worker@farm.test", "Safe-test-password-511!")
        self.admin = User.objects.create_superuser("admin@farm.test", "Safe-test-password-512!")
        self.farm = self.admin.profile.farms.first()
        self.worker.profile.farm = self.farm
        self.worker.profile.save(update_fields=("farm",))
        self.client.force_authenticate(self.worker)

    def test_animal_and_category_endpoints_require_authentication(self):
        self.client.force_authenticate(user=None)

        self.assertEqual(self.client.get("/api/animals/").status_code, 401)
        self.assertEqual(self.client.get("/api/animal-categories/").status_code, 401)

    def test_animal_list_filters_by_species_and_search(self):
        from finca.models import Animal

        Animal.objects.create(
            farm=self.farm,
            ica_code="ICA-100",
            species="vaca",
            sex="hembra",
            breed="Holstein",
        )
        Animal.objects.create(
            farm=self.farm,
            ica_code="ICA-200",
            species="caballo",
            sex="macho",
            breed="Criollo",
        )

        response = self.client.get("/api/animals/?species=bovino&search=hol")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([animal["ica_code"] for animal in response.data], ["ICA-100"])

    def test_worker_cannot_view_animals_from_another_farm(self):
        other_owner = User.objects.create_superuser(
            "other-owner@farm.test", "Safe-test-password-515!"
        )
        other_farm = other_owner.profile.farms.first()
        Animal.objects.create(
            farm=other_farm,
            ica_code="OTHER-FARM-ANIMAL",
            species="vaca",
            sex="hembra",
        )

        response = self.client.get("/api/animals/")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(any(row["ica_code"] == "OTHER-FARM-ANIMAL" for row in response.data))

    def test_owner_must_select_a_farm_they_own(self):
        other_owner = User.objects.create_superuser(
            "second-owner@farm.test", "Safe-test-password-518!"
        )
        other_farm = other_owner.profile.farms.first()
        Animal.objects.create(
            farm=self.farm,
            ica_code="OWNER-FARM-ANIMAL",
            species="vaca",
            sex="hembra",
        )
        owner_client = APIClient()
        owner_client.force_authenticate(self.admin)
        owner_client.credentials(HTTP_X_FARM_ID=str(self.farm.pk))
        own_farm = owner_client.get("/api/animals/")
        self.assertEqual(own_farm.status_code, 200)
        self.assertEqual([row["ica_code"] for row in own_farm.data], ["OWNER-FARM-ANIMAL"])

        owner_client.credentials(HTTP_X_FARM_ID=str(other_farm.pk))
        self.assertEqual(owner_client.get("/api/animals/").status_code, 403)

    def test_authenticated_worker_can_create_update_and_delete_animal(self):
        payload = {
            "ica_code": "ICA-300",
            "species": "vaca",
            "category": "VA",
            "sex": "hembra",
            "weight_kg": "250.00",
        }
        created = self.client.post("/api/animals/", payload, format="json")

        self.assertEqual(created.status_code, 201)
        animal_id = created.data["id"]
        updated = self.client.patch(
            f"/api/animals/{animal_id}/",
            {"health_status": "enfermo"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["health_status"], "enfermo")
        self.assertEqual(self.client.delete(f"/api/animals/{animal_id}/").status_code, 204)

    def test_creating_an_animal_with_an_existing_farm_tag_returns_validation_error(self):
        Animal.objects.create(
            farm=self.farm,
            ica_code="DUPLICATE-ICA",
            species="bovino",
            sex="hembra",
        )

        response = self.client.post(
            "/api/animals/",
            {"ica_code": "DUPLICATE-ICA", "species": "bovino", "sex": "hembra"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("ica_code", response.data)
        self.assertIn("ya está registrada en esta finca", str(response.data["ica_code"]))
        self.assertEqual(
            Animal.objects.filter(farm=self.farm, ica_code="DUPLICATE-ICA").count(),
            1,
        )

    def test_same_ica_code_can_be_used_in_a_different_farm(self):
        other_owner = User.objects.create_superuser(
            "other-tag-owner@farm.test",
            "Safe-test-password-519!",
        )
        other_farm = other_owner.profile.farms.first()
        Animal.objects.create(
            farm=self.farm,
            ica_code="FARM-SCOPED-ICA",
            species="bovino",
            sex="hembra",
        )
        other_client = APIClient()
        other_client.force_authenticate(other_owner)
        other_client.credentials(HTTP_X_FARM_ID=str(other_farm.pk))

        response = other_client.post(
            "/api/animals/",
            {"ica_code": "FARM-SCOPED-ICA", "species": "bovino", "sex": "hembra"},
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(
            Animal.objects.filter(ica_code="FARM-SCOPED-ICA").count(),
            2,
        )

    def test_lactation_status_is_only_valid_for_bovine_females(self):
        response = self.client.post(
            "/api/animals/",
            {
                "ica_code": "MALE-LACTATION",
                "species": "bovino",
                "sex": "macho",
                "lactation_status": "parida",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("lactation_status", response.data)

    def test_vaccine_animal_details_include_kind_and_notes_for_display(self):
        animal = Animal.objects.create(
            farm=self.farm,
            ica_code="VACCINE-DISPLAY",
            name="",
            notes="Lucero\nMarca blanca en la frente",
            species="bovino",
            sex="hembra",
        )
        Vaccine.objects.create(
            farm=self.farm,
            animal=animal,
            vaccine_name="Aftosa",
            scheduled_date=date(2026, 11, 5),
        )

        response = self.client.get("/api/vaccines/")

        self.assertEqual(response.status_code, 200)
        related_animal = response.data[0]["animal"]
        self.assertEqual(related_animal["species"], "bovino")
        self.assertEqual(related_animal["sex"], "hembra")
        self.assertEqual(related_animal["notes"], "Lucero\nMarca blanca en la frente")

    def test_vaccine_medication_options_are_limited_to_the_active_farm(self):
        own_medication = Medication.objects.create(
            farm=self.farm,
            name="Desparasitante",
            type="desparasitante",
            quantity=5,
            unit="ml",
        )
        other_owner = User.objects.create_superuser(
            "other-medication-owner@farm.test",
            "Safe-test-password-520!",
        )
        Medication.objects.create(
            farm=other_owner.profile.farms.first(),
            name="Medicamento ajeno",
            type="otro",
        )

        response = self.client.get("/api/vaccines/medication-options/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [own_medication.pk])
        self.assertEqual(response.data[0]["name"], own_medication.name)

    def test_offline_snapshot_includes_vaccine_medication_options(self):
        medication = Medication.objects.create(
            farm=self.farm,
            name="Medicamento para vacunas",
            type="antibiotico",
            quantity=1,
            unit="frasco",
        )

        response = self.client.get("/api/sync/snapshot/")

        self.assertEqual(response.status_code, 200)
        options = response.data["resources"]["/api/vaccines/medication-options/"]
        self.assertEqual([item["id"] for item in options], [str(medication.pk)])

    def test_vaccine_can_link_an_inventory_medication_without_merging_its_name(self):
        medication = Medication.objects.create(
            farm=self.farm,
            name="Antibiótico A",
            type="antibiotico",
            quantity=2,
            unit="frascos",
        )
        animal = Animal.objects.create(
            farm=self.farm,
            ica_code="VACCINE-MEDICATION-LINK",
            species="bovino",
            sex="hembra",
        )

        response = self.client.post(
            "/api/vaccines/",
            {
                "animal_id": str(animal.pk),
                "vaccine_name": "Aftosa",
                "scheduled_date": "2026-11-01",
                "medication_id": str(medication.pk),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        vaccine = Vaccine.objects.get(pk=response.data["id"])
        self.assertEqual(vaccine.vaccine_name, "Aftosa")
        self.assertEqual(vaccine.medication, "Antibiótico A")
        self.assertEqual(vaccine.medication_item_id, medication.pk)
        self.assertEqual(response.data["medication_id"], medication.pk)

    def test_vaccine_cannot_link_a_medication_from_another_farm(self):
        other_owner = User.objects.create_superuser(
            "other-medication-link@farm.test",
            "Safe-test-password-521!",
        )
        medication = Medication.objects.create(
            farm=other_owner.profile.farms.first(),
            name="Medicamento ajeno",
            type="otro",
        )
        animal = Animal.objects.create(
            farm=self.farm,
            ica_code="VACCINE-CROSS-FARM-MEDICATION",
            species="bovino",
            sex="hembra",
        )

        response = self.client.post(
            "/api/vaccines/",
            {
                "animal_id": str(animal.pk),
                "vaccine_name": "Aftosa",
                "scheduled_date": "2026-11-01",
                "medication_id": str(medication.pk),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("medication_id", response.data)

    def test_animal_category_writes_require_admin_and_default_category_cannot_be_deleted(self):
        worker_create = self.client.post(
            "/api/animal-categories/",
            {"code": "XEQ", "label": "Equino personalizado", "species": "equino", "color": "#112233"},
            format="json",
        )
        self.assertEqual(worker_create.status_code, 403)
        self.client.force_authenticate(self.admin)
        created = self.client.post(
            "/api/animal-categories/",
            {"code": "XEQ", "label": "Equino personalizado", "species": "equino", "color": "#112233"},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(
            self.client.delete(f"/api/animal-categories/{self.category_id}/").status_code,
            400,
        )

    @property
    def category_id(self):
        return AnimalCategory.objects.get(code="VA", species="bovino").pk


class MilkProductionApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        owner = User.objects.create_superuser("milk-owner@farm.test", "Safe-test-password-516!")
        self.user = User.objects.create_user("milker@farm.test", "Safe-test-password-513!")
        self.user.profile.farm = owner.profile.farms.first()
        self.user.profile.save(update_fields=("farm",))
        self.client.force_authenticate(self.user)
        self.cow = Animal.objects.create(
            farm=self.user.profile.farm,
            ica_code="COW-100",
            species="vaca",
            category="VA",
            sex="hembra",
            lactation_status="parida",
            active=True,
        )

    def test_list_returns_related_animal_and_total_and_filters(self):
        record = MilkProduction.objects.create(
            animal=self.cow,
            date=date(2026, 10, 26),
            morning_liters=Decimal("12.50"),
            afternoon_liters=Decimal("8.25"),
            registered_by=self.user.profile,
        )
        MilkProduction.objects.create(
            animal=self.cow,
            date=date(2026, 10, 1),
            morning_liters=Decimal("2.00"),
        )

        response = self.client.get(
            "/api/milk-production/?date_from=2026-10-20&search=COW-100"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], str(record.pk))
        self.assertEqual(response.data[0]["animal"]["ica_code"], "COW-100")
        self.assertEqual(response.data[0]["total_liters"], "20.75")
        self.assertEqual(response.data[0]["registered_by"], self.user.profile.pk)

    def test_create_sets_registered_profile_and_updates_and_deletes(self):
        payload = {
            "animal_id": str(self.cow.pk),
            "date": "2026-10-26",
            "morning_liters": "10.25",
            "afternoon_liters": "5.00",
            "notes": "Registro de prueba",
        }
        created = self.client.post("/api/milk-production/", payload, format="json")

        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["registered_by"], self.user.profile.pk)
        record_id = created.data["id"]
        updated = self.client.patch(
            f"/api/milk-production/{record_id}/",
            {"morning_liters": "11.00"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["total_liters"], "16.00")
        self.assertEqual(self.client.delete(f"/api/milk-production/{record_id}/").status_code, 204)

    def test_cannot_register_milk_for_ineligible_animal(self):
        horse = Animal.objects.create(
            farm=self.user.profile.farm,
            ica_code="HORSE-200",
            species="caballo",
            sex="hembra",
        )

        response = self.client.post(
            "/api/milk-production/",
            {"animal_id": str(horse.pk), "date": "2026-10-26"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_only_calved_or_lechera_females_can_be_selected_for_milk(self):
        filling = Animal.objects.create(
            farm=self.user.profile.farm,
            ica_code="FILLING-201",
            species="bovino",
            sex="hembra",
            lactation_status="llenando",
        )
        lechera_category = AnimalCategory.objects.create(
            code="LECH",
            label="Lechera",
            species="bovino",
        )
        lechera = Animal.objects.create(
            farm=self.user.profile.farm,
            ica_code="MILK-202",
            species="bovino",
            sex="hembra",
            category=lechera_category.code,
        )
        male_lechera = Animal.objects.create(
            farm=self.user.profile.farm,
            ica_code="MALE-203",
            species="bovino",
            sex="macho",
            category=lechera_category.code,
        )

        filling_response = self.client.post(
            "/api/milk-production/",
            {"animal_id": str(filling.pk), "date": "2026-10-26"},
            format="json",
        )
        lechera_response = self.client.post(
            "/api/milk-production/",
            {"animal_id": str(lechera.pk), "date": "2026-10-26"},
            format="json",
        )
        male_response = self.client.post(
            "/api/milk-production/",
            {"animal_id": str(male_lechera.pk), "date": "2026-10-26"},
            format="json",
        )

        self.assertEqual(filling_response.status_code, 400)
        self.assertEqual(lechera_response.status_code, 201)
        self.assertEqual(male_response.status_code, 400)

    def test_milk_production_api_requires_authentication(self):
        self.client.force_authenticate(user=None)

        self.assertEqual(self.client.get("/api/milk-production/").status_code, 401)


class WorkerActivitySubmissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            "activity-owner@farm.test", "Safe-test-password-520!"
        )
        self.worker = User.objects.create_user(
            "activity-worker@farm.test", "Safe-test-password-521!"
        )
        self.farm = self.admin.profile.farms.first()
        self.worker.profile.farm = self.farm
        self.worker.profile.save(update_fields=("farm",))
        self.client.force_authenticate(self.worker)
        self.payload = {
            "date": "2026-10-28",
            "activity_type": "alimentacion",
            "description": "Se alimentaron 12 animales con pasto fresco",
            "notes": "Turno de la mañana",
        }

    def test_activity_create_and_edit_are_reported_with_exact_submitted_values(self):
        created = self.client.post(
            "/api/daily-activities/", self.payload, format="json"
        )

        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["worker_id"], self.worker.profile.pk)
        updated = self.client.patch(
            f"/api/daily-activities/{created.data['id']}/",
            {"description": "Se alimentaron 14 animales con pasto fresco"},
            format="json",
        )

        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["worker_id"], self.worker.profile.pk)
        self.assertEqual(
            ActivitySubmission.objects.filter(
                farm=self.farm, submitted_by=self.worker.profile
            ).count(),
            2,
        )

        admin_client = APIClient()
        admin_client.force_authenticate(self.admin)
        admin_client.credentials(HTTP_X_FARM_ID=str(self.farm.pk))
        report = admin_client.get("/api/reports/worker-activities/")

        self.assertEqual(report.status_code, 200)
        self.assertEqual(report.data["count"], 2)
        self.assertEqual(
            [row["action"] for row in report.data["results"]],
            ["updated", "created"],
        )
        self.assertEqual(
            report.data["results"][0]["data"]["description"],
            "Se alimentaron 14 animales con pasto fresco",
        )
        self.assertEqual(
            report.data["results"][1]["data"]["description"],
            self.payload["description"],
        )

    def test_activity_deletion_keeps_the_worker_submission_in_report(self):
        created = self.client.post(
            "/api/daily-activities/", self.payload, format="json"
        )
        response = self.client.delete(f"/api/daily-activities/{created.data['id']}/")

        self.assertEqual(response.status_code, 204)
        submission = ActivitySubmission.objects.get(
            farm=self.farm,
            submitted_by=self.worker.profile,
            action=ActivitySubmission.Action.DELETED,
        )
        self.assertIsNone(submission.activity_id)
        self.assertEqual(submission.data["description"], self.payload["description"])

    def test_report_is_restricted_to_admin_and_selected_farm(self):
        response = self.client.get("/api/reports/worker-activities/")
        self.assertEqual(response.status_code, 403)

        other_admin = User.objects.create_superuser(
            "other-activity-owner@farm.test", "Safe-test-password-522!"
        )
        other_client = APIClient()
        other_client.force_authenticate(other_admin)
        other_farm = other_admin.profile.farms.first()
        other_client.credentials(HTTP_X_FARM_ID=str(other_farm.pk))
        report = other_client.get("/api/reports/worker-activities/")

        self.assertEqual(report.status_code, 200)
        self.assertEqual(report.data["count"], 0)


class MigratedResourceApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        owner = User.objects.create_superuser(
            "resource-owner@farm.test", "Safe-test-password-517!"
        )
        self.user = User.objects.create_user("resources@farm.test", "Safe-test-password-514!")
        self.user.profile.farm = owner.profile.farms.first()
        self.user.profile.save(update_fields=("farm",))
        self.client.force_authenticate(self.user)
        self.animal = Animal.objects.create(
            farm=self.user.profile.farm,
            ica_code="RESOURCE-ANIMAL",
            species="vaca",
            sex="hembra",
        )

    def test_vaccine_crud_returns_related_animal(self):
        response = self.client.post(
            "/api/vaccines/",
            {
                "animal_id": str(self.animal.pk),
                "vaccine_name": "Aftosa",
                "scheduled_date": "2026-11-01",
                "status": "pendiente",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["animal"]["ica_code"], self.animal.ica_code)
        self.assertIsNone(response.data["applied_by"])
        applied = self.client.patch(
            f"/api/vaccines/{response.data['id']}/",
            {"status": "aplicada", "applied_date": "2026-11-01"},
            format="json",
        )
        self.assertEqual(applied.status_code, 200)
        self.assertEqual(applied.data["applied_by"], self.user.profile.pk)

    def test_activities_and_disease_reports_assign_authenticated_profile(self):
        activity = self.client.post(
            "/api/daily-activities/",
            {
                "activity_type": "consulta_animal",
                "description": "Revisión veterinaria",
                "date": "2026-11-01",
                "animal_id": str(self.animal.pk),
            },
            format="json",
        )
        self.assertEqual(activity.status_code, 201)
        self.assertEqual(activity.data["worker_id"], self.user.profile.pk)
        self.assertEqual(activity.data["worker"]["id"], str(self.user.profile.pk))

        report = self.client.post(
            "/api/disease-reports/",
            {
                "animal_id": str(self.animal.pk),
                "report_date": "2026-11-01",
                "symptoms": "Fiebre",
                "status": "abierto",
            },
            format="json",
        )
        self.assertEqual(report.status_code, 201)
        self.assertEqual(report.data["reported_by"], self.user.profile.pk)
        self.assertEqual(report.data["animal"]["id"], str(self.animal.pk))

    def test_inventory_resources_are_authenticated_and_mutable(self):
        created = self.client.post(
            "/api/medications/",
            {"name": "Vitamina", "type": "vitamina", "quantity": "12", "unit": "ml"},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(
            self.client.patch(
                f"/api/medications/{created.data['id']}/",
                {"quantity": "8"},
                format="json",
            ).status_code,
            200,
        )
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/medications/").status_code, 401)

    def test_disabled_module_is_denied_by_the_backend(self):
        ModuleAccess.objects.update_or_create(
            farm=self.user.profile.farm,
            module_key="equipment",
            defaults={"label": "Equipos", "enabled_for_workers": False},
        )

        self.assertEqual(self.client.get("/api/equipment/").status_code, 403)

    def test_module_access_is_independent_per_farm(self):
        other_owner = User.objects.create_superuser(
            "other-module-owner@farm.test", "Safe-test-password-519!"
        )
        other_farm = other_owner.profile.farms.first()
        ModuleAccess.objects.filter(
            farm=other_farm,
            module_key="equipment",
        ).update(enabled_for_workers=False)

        self.assertEqual(self.client.get("/api/equipment/").status_code, 200)
