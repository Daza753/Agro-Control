import uuid

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import ModuleAccess, User
from finca.models import ActivitySubmission, Animal, DailyActivity, Medication, SyncOperation, Vaccine
from finca.serializers import AnimalSerializer, DailyActivitySerializer, VaccineSerializer


class OfflineSyncApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser("sync-admin@example.test", "Safe-test-password-100!")
        self.farm = self.admin.profile.farms.first()
        self.worker = User.objects.create_user("sync-worker@example.test", "Safe-test-password-101!")
        self.worker.profile.farm = self.farm
        self.worker.profile.save(update_fields=("farm",))
        self.client.force_authenticate(self.worker)
        self.url = "/api/sync/"

    def test_create_is_idempotent_and_preserves_client_id(self):
        operation_id = uuid.uuid4()
        operation = {
            "id": str(operation_id),
            "farm_id": str(self.farm.pk),
            "path": "/api/animals/",
            "method": "POST",
            "body": {"ica_code": "OFFLINE-1", "species": "vaca", "sex": "hembra"},
            "base_state": None,
        }

        first = self.client.post(self.url, {"operations": [operation]}, format="json")
        repeated = self.client.post(self.url, {"operations": [operation]}, format="json")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data["results"][0]["status"], "applied")
        self.assertEqual(first.data["results"][0]["data"]["id"], str(operation_id))
        self.assertEqual(repeated.data["results"][0]["status"], "applied")
        self.assertTrue(repeated.data["results"][0]["replayed"])
        self.assertEqual(Animal.objects.filter(farm=self.farm, ica_code="OFFLINE-1").count(), 1)
        self.assertEqual(SyncOperation.objects.filter(user=self.worker, operation_id=operation_id).count(), 1)

    def test_create_animal_with_bull_category_and_full_details(self):
        operation = {
            "id": str(uuid.uuid4()),
            "farm_id": str(self.farm.pk),
            "path": "/api/animals/",
            "method": "POST",
            "body": {
                "ica_code": "0010",
                "name": "",
                "species": "bovino",
                "category": "TO",
                "breed": "Gyr",
                "sex": "macho",
                "birth_date": "2000-10-10",
                "weight_kg": 400,
                "health_status": "sano",
                "lactation_status": None,
                "notes": None,
            },
            "base_state": None,
        }

        response = self.client.post(self.url, {"operations": [operation]}, format="json")

        result = response.data["results"][0]
        self.assertEqual(result["status"], "applied", result)
        animal = Animal.objects.get(farm=self.farm, ica_code="0010")
        self.assertEqual(animal.category, "TO")
        self.assertEqual(animal.breed, "Gyr")

    def test_animal_ica_code_is_unique_per_farm_not_globally(self):
        other_admin = User.objects.create_superuser(
            "other-sync-admin@example.test",
            "Safe-test-password-102!",
        )
        other_farm = other_admin.profile.farms.first()
        Animal.objects.create(
            farm=self.farm,
            ica_code="SAME-CODE",
            species="bovino",
            sex="macho",
        )

        other_animal = Animal.objects.create(
            farm=other_farm,
            ica_code="SAME-CODE",
            species="bovino",
            sex="macho",
        )

        self.assertEqual(other_animal.ica_code, "SAME-CODE")

    def test_duplicate_animal_ica_code_returns_correctable_sync_error(self):
        Animal.objects.create(
            farm=self.farm,
            ica_code="DUPLICATE-ICA",
            species="vaca",
            sex="hembra",
        )
        operation = {
            "id": str(uuid.uuid4()),
            "farm_id": str(self.farm.pk),
            "path": "/api/animals/",
            "method": "POST",
            "body": {"ica_code": "DUPLICATE-ICA", "species": "vaca", "sex": "hembra"},
            "base_state": None,
        }

        response = self.client.post(self.url, {"operations": [operation]}, format="json")

        self.assertEqual(response.data["results"][0]["status"], "rejected")
        self.assertIn(
            "chapeta ICA ya está registrada",
            response.data["results"][0]["error"],
        )
        self.assertEqual(Animal.objects.filter(farm=self.farm, ica_code="DUPLICATE-ICA").count(), 1)

    def test_vaccine_sync_links_only_a_medication_from_the_same_farm(self):
        medication = Medication.objects.create(
            farm=self.farm,
            name="Antibiótico de inventario",
            type="antibiotico",
            quantity=3,
            unit="frascos",
        )
        operation = {
            "id": str(uuid.uuid4()),
            "farm_id": str(self.farm.pk),
            "path": "/api/vaccines/",
            "method": "POST",
            "body": {
                "vaccine_name": "Aftosa",
                "scheduled_date": "2026-11-05",
                "medication_id": str(medication.pk),
            },
            "base_state": None,
        }

        response = self.client.post(self.url, {"operations": [operation]}, format="json")

        result = response.data["results"][0]
        self.assertEqual(result["status"], "applied", result)
        vaccine = Vaccine.objects.get(pk=result["data"]["id"])
        self.assertEqual(vaccine.vaccine_name, "Aftosa")
        self.assertEqual(vaccine.medication, medication.name)
        self.assertEqual(vaccine.medication_item_id, medication.pk)

    def test_editing_existing_animal_updates_it_without_creating_another(self):
        animal = Animal.objects.create(
            farm=self.farm,
            ica_code="2000",
            species="bovino",
            sex="macho",
            breed="Inicial",
        )
        operation = {
            "id": str(uuid.uuid4()),
            "farm_id": str(self.farm.pk),
            "path": f"/api/animals/{animal.pk}/",
            "method": "PATCH",
            "body": {"category": "NO", "breed": "Actualizada"},
            "base_state": AnimalSerializer(animal).data,
        }

        response = self.client.post(self.url, {"operations": [operation]}, format="json")

        self.assertEqual(response.data["results"][0]["status"], "applied")
        animal.refresh_from_db()
        self.assertEqual(animal.breed, "Actualizada")
        self.assertEqual(animal.category, "NO")
        self.assertEqual(Animal.objects.filter(farm=self.farm, ica_code="2000").count(), 1)

    def test_create_serializes_nested_uuids_before_storing_sync_receipt(self):
        animal = Animal.objects.create(
            farm=self.farm,
            ica_code="VACCINE-ANIMAL",
            species="bovino",
            sex="hembra",
        )
        operation_id = uuid.uuid4()
        operation = {
            "id": str(operation_id),
            "farm_id": str(self.farm.pk),
            "path": "/api/vaccines/",
            "method": "POST",
            "body": {
                "animal_id": str(animal.pk),
                "vaccine_name": "Aftosa",
                "scheduled_date": "2026-10-28",
                "status": "pendiente",
            },
            "base_state": None,
        }

        response = self.client.post(self.url, {"operations": [operation]}, format="json")
        receipt = SyncOperation.objects.get(user=self.worker, operation_id=operation_id)

        self.assertEqual(response.data["results"][0]["status"], "applied")
        self.assertEqual(receipt.result["data"]["animal"]["id"], str(animal.pk))
        self.assertTrue(Vaccine.objects.filter(farm=self.farm, animal=animal).exists())

    def test_vaccine_status_patch_succeeds_when_an_unrelated_field_changed_on_server(self):
        vaccine = Vaccine.objects.create(
            farm=self.farm,
            vaccine_name="Aftosa",
            scheduled_date="2026-11-05",
            notes="Nota original",
        )
        base_state = VaccineSerializer(vaccine).data
        vaccine.notes = "Nota actualizada en servidor"
        vaccine.save(update_fields=("notes",))
        operation = {
            "id": str(uuid.uuid4()),
            "farm_id": str(self.farm.pk),
            "path": f"/api/vaccines/{vaccine.pk}/",
            "method": "PATCH",
            "body": {"status": "aplicada", "applied_date": "2026-11-05"},
            "base_state": base_state,
        }

        response = self.client.post(self.url, {"operations": [operation]}, format="json")

        result = response.data["results"][0]
        self.assertEqual(result["status"], "applied", result)
        vaccine.refresh_from_db()
        self.assertEqual(vaccine.status, Vaccine.Status.APPLIED)
        self.assertEqual(vaccine.applied_date.isoformat(), "2026-11-05")
        self.assertEqual(vaccine.applied_by_id, self.worker.profile.pk)
        self.assertEqual(vaccine.notes, "Nota actualizada en servidor")

    def test_vaccine_status_patch_conflicts_when_status_changed_on_server(self):
        vaccine = Vaccine.objects.create(
            farm=self.farm,
            vaccine_name="Aftosa",
            scheduled_date="2026-11-05",
            status=Vaccine.Status.PENDING,
        )
        base_state = VaccineSerializer(vaccine).data
        vaccine.status = Vaccine.Status.EXPIRED
        vaccine.save(update_fields=("status",))
        operation = {
            "id": str(uuid.uuid4()),
            "farm_id": str(self.farm.pk),
            "path": f"/api/vaccines/{vaccine.pk}/",
            "method": "PATCH",
            "body": {"status": Vaccine.Status.APPLIED, "applied_date": "2026-11-05"},
            "base_state": base_state,
        }

        response = self.client.post(self.url, {"operations": [operation]}, format="json")

        result = response.data["results"][0]
        self.assertEqual(result["status"], "conflict")
        self.assertEqual(result["server"]["status"], Vaccine.Status.EXPIRED)
        vaccine.refresh_from_db()
        self.assertEqual(vaccine.status, Vaccine.Status.EXPIRED)

    def test_vaccine_status_patch_is_idempotent_when_server_already_has_requested_values(self):
        vaccine = Vaccine.objects.create(
            farm=self.farm,
            vaccine_name="Aftosa",
            scheduled_date="2026-11-05",
            status=Vaccine.Status.PENDING,
        )
        base_state = VaccineSerializer(vaccine).data
        vaccine.status = Vaccine.Status.APPLIED
        vaccine.applied_date = "2026-11-05"
        vaccine.save(update_fields=("status", "applied_date"))
        operation = {
            "id": str(uuid.uuid4()),
            "farm_id": str(self.farm.pk),
            "path": f"/api/vaccines/{vaccine.pk}/",
            "method": "PATCH",
            "body": {"status": Vaccine.Status.APPLIED, "applied_date": "2026-11-05"},
            "base_state": base_state,
        }

        response = self.client.post(self.url, {"operations": [operation]}, format="json")

        result = response.data["results"][0]
        self.assertEqual(result["status"], "applied", result)
        vaccine.refresh_from_db()
        self.assertEqual(vaccine.status, Vaccine.Status.APPLIED)
        self.assertEqual(vaccine.applied_date.isoformat(), "2026-11-05")

    def test_snapshot_contains_each_offline_resource_for_the_selected_farm(self):
        response = self.client.get("/api/sync/snapshot/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["farm_id"], str(self.farm.pk))
        self.assertEqual(
            set(response.data["resources"]),
            {
                "/api/animals/", "/api/animal-categories/", "/api/milk-production/",
                "/api/vaccines/", "/api/daily-activities/", "/api/disease-reports/",
                "/api/vaccines/medication-options/",
                "/api/medications/", "/api/inputs/", "/api/equipment/", "/api/crops/",
                "/api/fish-farming/", "/api/farm-settings/", "/api/module-access/",
                "/api/module-themes/",
            },
        )
        self.assertTrue(all(isinstance(rows, list) for rows in response.data["resources"].values()))

    def test_snapshot_hides_a_disabled_module_from_workers(self):
        ModuleAccess.objects.update_or_create(
            farm=self.farm,
            module_key="animals",
            defaults={"enabled_for_workers": False, "label": "Animales"},
        )
        Animal.objects.create(farm=self.farm, ica_code="HIDDEN", species="vaca", sex="hembra")

        response = self.client.get("/api/sync/snapshot/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["resources"]["/api/animals/"], [])

    def test_offline_activity_sync_is_linked_to_worker_and_reported_once(self):
        operation_id = uuid.uuid4()
        operation = {
            "id": str(operation_id),
            "farm_id": str(self.farm.pk),
            "path": "/api/daily-activities/",
            "method": "POST",
            "body": {
                "date": "2026-10-28",
                "activity_type": "alimentacion",
                "description": "Carga offline de alimento",
                "animal_id": None,
                "notes": "Sin conexión",
            },
            "base_state": None,
        }

        first = self.client.post(self.url, {"operations": [operation]}, format="json")
        repeated = self.client.post(self.url, {"operations": [operation]}, format="json")

        self.assertEqual(first.data["results"][0]["status"], "applied")
        self.assertEqual(repeated.data["results"][0]["status"], "applied")
        self.assertTrue(repeated.data["results"][0]["replayed"])
        activity = DailyActivity.objects.get(pk=operation_id)
        self.assertEqual(activity.farm_id, self.farm.pk)
        self.assertEqual(activity.worker_id, self.worker.profile.pk)
        self.assertEqual(
            ActivitySubmission.objects.filter(
                activity=activity,
                submitted_by=self.worker.profile,
                action=ActivitySubmission.Action.CREATED,
            ).count(),
            1,
        )

        admin_client = APIClient()
        admin_client.force_authenticate(self.admin)
        admin_client.credentials(HTTP_X_FARM_ID=str(self.farm.pk))
        report = admin_client.get("/api/reports/worker-activities/")
        self.assertEqual(report.data["count"], 1)
        self.assertEqual(
            report.data["results"][0]["data"]["description"],
            "Carga offline de alimento",
        )

    def test_stale_edit_is_reported_as_conflict_without_overwriting(self):
        animal = Animal.objects.create(
            farm=self.farm, ica_code="OFFLINE-2", species="vaca", sex="hembra", name="Initial"
        )
        base_state = AnimalSerializer(animal).data
        animal.name = "Server edit"
        animal.save(update_fields=("name", "updated_at"))
        operation = {
            "id": str(uuid.uuid4()),
            "farm_id": str(self.farm.pk),
            "path": f"/api/animals/{animal.pk}/",
            "method": "PATCH",
            "body": {"name": "Offline edit"},
            "base_state": base_state,
        }

        response = self.client.post(self.url, {"operations": [operation]}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"][0]["status"], "conflict")
        animal.refresh_from_db()
        self.assertEqual(animal.name, "Server edit")

    def test_explicit_delete_removes_a_record_even_if_its_cached_state_is_stale(self):
        vaccine = Vaccine.objects.create(
            farm=self.farm,
            vaccine_name="Aftosa",
            scheduled_date="2026-11-05",
            notes="Estado inicial",
        )
        base_state = VaccineSerializer(vaccine).data
        vaccine.notes = "Cambio hecho en el servidor"
        vaccine.save(update_fields=("notes",))
        operation = {
            "id": str(uuid.uuid4()),
            "farm_id": str(self.farm.pk),
            "path": f"/api/vaccines/{vaccine.pk}/",
            "method": "DELETE",
            "body": None,
            "base_state": base_state,
        }

        response = self.client.post(self.url, {"operations": [operation]}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"][0]["status"], "applied")
        self.assertFalse(Vaccine.objects.filter(pk=vaccine.pk).exists())

    def test_conflicted_vaccine_edit_can_be_replaced_by_an_explicit_delete(self):
        vaccine = Vaccine.objects.create(
            farm=self.farm,
            vaccine_name="Aftosa",
            scheduled_date="2026-11-05",
            notes="Estado inicial",
        )
        base_state = VaccineSerializer(vaccine).data
        vaccine.notes = "Cambio hecho en el servidor"
        vaccine.save(update_fields=("notes",))
        operation = {
            "id": str(uuid.uuid4()),
            "farm_id": str(self.farm.pk),
            "path": f"/api/vaccines/{vaccine.pk}/",
            "method": "PATCH",
            "body": {"notes": "Cambio offline"},
            "base_state": base_state,
        }

        conflict = self.client.post(self.url, {"operations": [operation]}, format="json")
        self.assertEqual(conflict.data["results"][0]["status"], "conflict")
        delete = {
            **operation,
            "method": "DELETE",
            "body": None,
            "base_state": conflict.data["results"][0]["server"],
        }

        response = self.client.post(self.url, {"operations": [delete]}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"][0]["status"], "applied")
        self.assertFalse(Vaccine.objects.filter(pk=vaccine.pk).exists())

    def test_conflicted_activity_can_be_deleted_after_user_confirms(self):
        activity = DailyActivity.objects.create(
            farm=self.farm,
            worker=self.worker.profile,
            activity_type=DailyActivity.Type.FEEDING,
            description="Descripción inicial",
        )
        base_state = DailyActivitySerializer(activity).data
        activity.description = "Descripción actualizada en servidor"
        activity.save(update_fields=("description",))
        operation = {
            "id": str(uuid.uuid4()),
            "farm_id": str(self.farm.pk),
            "path": f"/api/daily-activities/{activity.pk}/",
            "method": "PATCH",
            "body": {"description": "Edición local"},
            "base_state": base_state,
        }

        conflict = self.client.post(
            self.url,
            {"operations": [operation]},
            format="json",
        )

        self.assertEqual(conflict.data["results"][0]["status"], "conflict")
        delete = {
            **operation,
            "method": "DELETE",
            "body": None,
            "base_state": conflict.data["results"][0]["server"],
        }
        response = self.client.post(
            self.url,
            {"operations": [delete]},
            format="json",
        )

        self.assertEqual(response.data["results"][0]["status"], "applied")
        self.assertFalse(DailyActivity.objects.filter(pk=activity.pk).exists())
        self.assertTrue(
            ActivitySubmission.objects.filter(
                activity__isnull=True,
                submitted_by=self.worker.profile,
                action=ActivitySubmission.Action.DELETED,
                data__description="Descripción actualizada en servidor",
            ).exists()
        )

    def test_replay_rechecks_worker_module_permission(self):
        ModuleAccess.objects.update_or_create(
            farm=self.farm,
            module_key="animals",
            defaults={"enabled_for_workers": False, "label": "Animales"},
        )
        operation = {
            "id": str(uuid.uuid4()),
            "farm_id": str(self.farm.pk),
            "path": "/api/animals/",
            "method": "POST",
            "body": {"ica_code": "OFFLINE-3", "species": "vaca", "sex": "hembra"},
            "base_state": None,
        }

        response = self.client.post(self.url, {"operations": [operation]}, format="json")

        self.assertEqual(response.data["results"][0]["status"], "rejected")
        self.assertFalse(Animal.objects.filter(farm=self.farm, ica_code="OFFLINE-3").exists())

    def test_replay_of_applied_operation_remains_idempotent_after_permission_change(self):
        operation_id = uuid.uuid4()
        operation = {
            "id": str(operation_id),
            "farm_id": str(self.farm.pk),
            "path": "/api/animals/",
            "method": "POST",
            "body": {"ica_code": "OFFLINE-4", "species": "vaca", "sex": "hembra"},
            "base_state": None,
        }
        first = self.client.post(self.url, {"operations": [operation]}, format="json")
        ModuleAccess.objects.update_or_create(
            farm=self.farm,
            module_key="animals",
            defaults={"enabled_for_workers": False, "label": "Animales"},
        )

        replay = self.client.post(self.url, {"operations": [operation]}, format="json")

        self.assertEqual(first.data["results"][0]["status"], "applied")
        self.assertEqual(replay.data["results"][0]["status"], "applied")
        self.assertTrue(replay.data["results"][0]["replayed"])
        self.assertEqual(Animal.objects.filter(farm=self.farm, ica_code="OFFLINE-4").count(), 1)

    def test_account_mutations_are_not_supported_by_sync_endpoint(self):
        for path in ("/api/auth/users/", "/api/auth/password/change/", "/api/auth/farms/"):
            response = self.client.post(self.url, {"operations": [{
                "id": str(uuid.uuid4()),
                "farm_id": str(self.farm.pk),
                "path": path,
                "method": "POST",
                "body": {"password": "do-not-store"},
                "base_state": None,
            }]}, format="json")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["results"][0]["status"], "rejected")

    def test_password_fields_never_enter_the_offline_sync_receipt(self):
        operation_id = uuid.uuid4()
        response = self.client.post(self.url, {"operations": [{
            "id": str(operation_id),
            "farm_id": str(self.farm.pk),
            "path": "/api/animals/",
            "method": "POST",
            "body": {"ica_code": "NO-CREDENTIALS", "species": "vaca", "sex": "hembra", "password": "do-not-store"},
            "base_state": None,
        }]}, format="json")

        self.assertEqual(response.data["results"][0]["status"], "rejected")
        self.assertFalse(SyncOperation.objects.filter(operation_id=operation_id).exists())
        self.assertFalse(Animal.objects.filter(farm=self.farm, ica_code="NO-CREDENTIALS").exists())

    def test_admin_cannot_replay_an_operation_against_a_different_farm(self):
        other_admin = User.objects.create_superuser(
            "sync-other@example.test", "Safe-test-password-102!"
        )
        other_farm = other_admin.profile.farms.first()
        operation = {
            "id": str(uuid.uuid4()),
            "farm_id": str(other_farm.pk),
            "path": "/api/animals/",
            "method": "POST",
            "body": {"ica_code": "WRONG-FARM", "species": "vaca", "sex": "hembra"},
            "base_state": None,
        }

        response = self.client.post(
            self.url,
            {"operations": [operation]},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["results"][0]["status"], "rejected")
        self.assertFalse(Animal.objects.filter(ica_code="WRONG-FARM").exists())
