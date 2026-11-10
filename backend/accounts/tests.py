from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import Profile, User


class UserProfileTests(TestCase):
    def test_new_user_gets_worker_profile(self):
        user = User.objects.create_user("worker@example.com", "Safe-test-password-381!")

        self.assertEqual(user.profile.role, Profile.Role.WORKER)
        self.assertTrue(user.check_password("Safe-test-password-381!"))

    def test_new_superuser_gets_admin_profile(self):
        user = User.objects.create_superuser("admin@example.com", "Safe-test-password-382!")

        self.assertEqual(user.profile.role, Profile.Role.ADMIN)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)


class AuthenticationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.password = "Safe-test-password-383!"
        self.user = User.objects.create_user("api@example.com", self.password)

    def test_login_returns_access_and_refresh_tokens(self):
        response = self.client.post(
            "/api/auth/login/",
            {"email": self.user.email, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_inactive_profile_cannot_log_in(self):
        self.user.profile.active = False
        self.user.profile.save(update_fields=("active",))

        response = self.client.post(
            "/api/auth/login/",
            {"email": self.user.email, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, 401)

    def test_current_user_requires_authentication(self):
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(self.user)}"
        )
        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["email"], self.user.email)
        self.assertEqual(response.data["profile"]["role"], Profile.Role.WORKER)

    def test_password_change_checks_current_password_and_validates_new_password(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            "/api/auth/password/change/",
            {
                "current_password": self.password,
                "new_password": "New-safe-test-password-384!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 204)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("New-safe-test-password-384!"))


class UserManagementApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser("manager@example.com", "Safe-test-password-385!")
        self.worker = User.objects.create_user("managed@example.com", "Safe-test-password-386!")
        self.farm = self.admin.profile.farms.first()
        self.worker.profile.farm = self.farm
        self.worker.profile.save(update_fields=("farm",))
        self.client.force_authenticate(self.admin)

    def test_admin_can_create_and_update_users(self):
        created = self.client.post(
            "/api/auth/users/",
            {
                "email": "new-worker@example.com",
                "full_name": "Nuevo trabajador",
                "role": "trabajador",
                "active": True,
                "password": "Strong-account-password-387!",
                "farm_id": str(self.farm.pk),
            },
            format="json",
        )

        self.assertEqual(created.status_code, 201)
        profile_id = created.data["id"]
        profile = Profile.objects.get(pk=profile_id)
        self.assertEqual(profile.user_id, profile.pk)
        self.assertEqual(profile.user.email, "new-worker@example.com")
        self.assertEqual(profile.role, Profile.Role.WORKER)
        self.assertEqual(profile.farm, self.farm)
        self.assertEqual(profile.created_by, self.admin.profile)
        self.assertTrue(profile.user.check_password("Strong-account-password-387!"))

        updated = self.client.patch(
            f"/api/auth/users/{profile_id}/",
            {"full_name": "Trabajador actualizado"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["full_name"], "Trabajador actualizado")

        worker_client = APIClient()
        worker_client.force_authenticate(profile.user)
        worker_farms = worker_client.get("/api/auth/farms/")
        self.assertEqual(worker_farms.status_code, 200)
        self.assertEqual([row["id"] for row in worker_farms.data], [str(self.farm.pk)])

        activity = worker_client.post(
            "/api/daily-activities/",
            {
                "date": "2026-10-28",
                "activity_type": "otro",
                "description": "Dato registrado por el empleado",
            },
            format="json",
        )
        self.assertEqual(activity.status_code, 201)
        self.assertEqual(activity.data["worker_id"], profile.pk)

        admin_client = APIClient()
        admin_client.force_authenticate(self.admin)
        admin_client.credentials(HTTP_X_FARM_ID=str(self.farm.pk))
        shared_activities = admin_client.get("/api/daily-activities/")
        self.assertEqual(shared_activities.status_code, 200)
        self.assertEqual(shared_activities.data[0]["id"], activity.data["id"])
        self.assertEqual(shared_activities.data[0]["worker"]["full_name"], "Trabajador actualizado")

    def test_invalid_worker_password_returns_validation_error(self):
        response = self.client.post(
            "/api/auth/users/",
            {
                "email": "invalid-password-worker@example.com",
                "full_name": "Trabajador",
                "role": Profile.Role.WORKER,
                "active": True,
                "password": "123",
                "farm_id": str(self.farm.pk),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data)
        self.assertFalse(User.objects.filter(email="invalid-password-worker@example.com").exists())

    def test_admin_can_create_farm_and_its_module_settings(self):
        response = self.client.post(
            "/api/auth/farms/",
            {"name": "Finca Los Robles"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        farm = self.admin.profile.farms.get(pk=response.data["id"])
        self.assertEqual(farm.settings.get().farm_name, "Finca Los Robles")
        self.assertEqual(farm.module_access.count(), 14)
        self.assertEqual(farm.module_themes.count(), 14)

    def test_admin_can_update_farm_logo_and_user_photo(self):
        logo = "data:image/png;base64,aGVsbG8="
        farm_response = self.client.patch(
            f"/api/auth/farms/{self.farm.pk}/",
            {"name": "Mi Finca Actualizada", "logo_url": logo},
            format="json",
        )
        self.assertEqual(farm_response.status_code, 200)
        self.assertEqual(farm_response.data["logo_url"], logo)
        self.assertEqual(self.farm.settings.get().logo_url, logo)
        listed_farms = self.client.get("/api/auth/farms/")
        self.assertEqual(listed_farms.status_code, 200)
        self.assertEqual(
            next(row for row in listed_farms.data if row["id"] == str(self.farm.pk))["logo_url"],
            logo,
        )

        photo = "data:image/webp;base64,aGVsbG8="
        user_response = self.client.patch(
            f"/api/auth/users/{self.worker.profile.pk}/",
            {"photo_url": photo},
            format="json",
        )
        self.assertEqual(user_response.status_code, 200, user_response.data)
        self.assertEqual(
            Profile.objects.get(pk=self.worker.profile.pk).photo_url,
            photo,
        )

    def test_deleting_farm_removes_its_workers_and_keeps_other_farms(self):
        farm_response = self.client.post(
            "/api/auth/farms/",
            {"name": "Finca que se eliminará"},
            format="json",
        )
        self.assertEqual(farm_response.status_code, 201)
        farm_id = farm_response.data["id"]

        worker_response = self.client.post(
            "/api/auth/users/",
            {
                "email": "deleted-farm-worker@example.com",
                "full_name": "Trabajador de finca eliminada",
                "role": Profile.Role.WORKER,
                "active": True,
                "password": "Strong-account-password-390!",
                "farm_id": farm_id,
            },
            format="json",
        )
        self.assertEqual(worker_response.status_code, 201)
        worker_id = worker_response.data["id"]

        deleted = self.client.delete(f"/api/auth/farms/{farm_id}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(User.objects.filter(email="deleted-farm-worker@example.com").exists())
        self.assertFalse(Profile.objects.filter(pk=worker_id).exists())
        self.assertFalse(self.admin.profile.farms.filter(pk=farm_id).exists())
        self.assertTrue(self.admin.profile.farms.filter(name="Mi Finca").exists())

    def test_admin_with_farms_cannot_be_demoted_or_deleted(self):
        created = self.client.post(
            "/api/auth/users/",
            {
                "email": "second-admin@example.com",
                "full_name": "Segundo administrador",
                "role": Profile.Role.ADMIN,
                "active": True,
                "password": "Strong-account-password-388!",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        second_admin = User.objects.get(email="second-admin@example.com")
        second_admin_farm = second_admin.profile.farms.get()

        second_admin_client = APIClient()
        second_admin_client.force_authenticate(second_admin)
        worker_response = second_admin_client.post(
            "/api/auth/users/",
            {
                "email": "second-admin-worker@example.com",
                "full_name": "Trabajador del segundo administrador",
                "role": Profile.Role.WORKER,
                "active": True,
                "password": "Strong-account-password-389!",
                "farm_id": str(second_admin_farm.pk),
            },
            format="json",
        )
        self.assertEqual(worker_response.status_code, 201)
        worker = Profile.objects.get(pk=worker_response.data["id"])
        self.assertEqual(worker.farm, second_admin_farm)
        self.assertEqual(worker.created_by, second_admin.profile)

        demoted = self.client.patch(
            f"/api/auth/users/{created.data['id']}/",
            {"role": Profile.Role.WORKER},
            format="json",
        )
        self.assertEqual(demoted.status_code, 400)

        deleted = self.client.delete(f"/api/auth/users/{created.data['id']}/")
        self.assertEqual(deleted.status_code, 400)
        self.assertTrue(User.objects.filter(pk=second_admin.pk).exists())

    def test_last_active_admin_cannot_be_disabled_and_workers_cannot_manage_users(self):
        denied = APIClient().get("/api/auth/users/")
        self.assertEqual(denied.status_code, 401)

        response = self.client.patch(
            f"/api/auth/users/{self.admin.profile.pk}/",
            {"active": False},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

        self.client.force_authenticate(self.worker)
        self.assertEqual(self.client.get("/api/auth/users/").status_code, 403)
