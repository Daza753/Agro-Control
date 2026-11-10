from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.farms import create_farm
from accounts.models import Farm, Profile, User
from accounts.serializers import CurrentUserSerializer, PasswordChangeSerializer


def validate_account_password(password, user=None):
    try:
        validate_password(password, user=user)
    except DjangoValidationError as error:
        raise ValidationError({"password": error.messages}) from error


class LoginView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]

    def get_serializer_class(self):
        return ActiveProfileTokenSerializer


class ActiveProfileTokenSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.profile.active:
            raise AuthenticationFailed("La cuenta está inactiva.")
        return data


class RefreshTokenView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]


class CurrentUserView(APIView):
    def get(self, request):
        return Response(CurrentUserSerializer(request.user).data)


class PasswordChangeView(APIView):
    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FarmsView(APIView):
    def get(self, request):
        profile = request.user.profile
        if not request.user.is_active or not profile.active:
            raise PermissionDenied("La cuenta está inactiva.")
        if profile.role == Profile.Role.ADMIN:
            farms = Farm.objects.filter(owner=profile).prefetch_related("settings")
        else:
            farms = (
                Farm.objects.filter(pk=profile.farm_id).prefetch_related("settings")
                if profile.farm_id else Farm.objects.none()
            )
        return Response([
            {
                "id": str(farm.pk),
                "name": farm.name,
                "logo_url": farm.settings.first().logo_url if farm.settings.exists() else None,
            }
            for farm in farms.order_by("name")
        ])

    def post(self, request):
        require_active_admin(request)
        name = request.data.get("name")
        if not isinstance(name, str) or not name.strip():
            raise ValidationError({"name": "El nombre de la finca es obligatorio."})
        name = name.strip()
        if len(name) > 200:
            raise ValidationError({"name": "El nombre no puede superar 200 caracteres."})
        if Farm.objects.filter(owner=request.user.profile, name__iexact=name).exists():
            raise ValidationError({"name": "Ya existe una finca con ese nombre."})
        farm = create_farm(request.user.profile, name)
        return Response(
            {"id": str(farm.pk), "name": farm.name, "logo_url": None},
            status=status.HTTP_201_CREATED,
        )


class FarmDetailView(APIView):
    def patch(self, request, farm_id):
        require_active_admin(request)
        try:
            farm = Farm.objects.get(pk=farm_id, owner=request.user.profile)
        except (Farm.DoesNotExist, ValueError):
            return Response({"detail": "Finca no encontrada."}, status=status.HTTP_404_NOT_FOUND)

        name = request.data.get("name", farm.name)
        farm_settings = farm.settings.first()
        logo_url = request.data.get("logo_url", farm_settings.logo_url if farm_settings else None)
        if not isinstance(name, str) or not name.strip():
            raise ValidationError({"name": "El nombre de la finca es obligatorio."})
        name = name.strip()
        if len(name) > 200:
            raise ValidationError({"name": "El nombre no puede superar 200 caracteres."})
        if Farm.objects.filter(owner=request.user.profile, name__iexact=name).exclude(pk=farm.pk).exists():
            raise ValidationError({"name": "Ya existe una finca con ese nombre."})
        validate_image_data(logo_url, "logo_url")

        with transaction.atomic():
            farm.name = name
            farm.save(update_fields=("name",))
            farm_settings = farm.settings.first()
            if not farm_settings:
                raise ValidationError({"detail": "La configuración de la finca no existe."})
            farm_settings.farm_name = name
            farm_settings.logo_url = logo_url
            farm_settings.save(update_fields=("farm_name", "logo_url", "updated_at"))
        return Response({"id": str(farm.pk), "name": farm.name, "logo_url": farm_settings.logo_url})

    def delete(self, request, farm_id):
        require_active_admin(request)
        with transaction.atomic():
            try:
                farm = Farm.objects.select_for_update().get(
                    pk=farm_id,
                    owner=request.user.profile,
                )
            except (Farm.DoesNotExist, ValueError):
                return Response({"detail": "Finca no encontrada."}, status=status.HTTP_404_NOT_FOUND)

            employees = Profile.objects.filter(farm=farm).select_related("user")
            for employee in employees:
                employee.user.delete()
            farm.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def validate_image_data(value, field_name):
    if value is not None and (
        not isinstance(value, str)
        or not value.startswith(("data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,", "data:image/gif;base64,"))
        or len(value) > 3_000_000
    ):
        raise ValidationError({field_name: "La imagen no es válida o supera el límite de 2 MB."})


def require_active_admin(request):
    if (
        not request.user.is_authenticated
        or not request.user.is_active
        or not hasattr(request.user, "profile")
        or not request.user.profile.active
        or request.user.profile.role != Profile.Role.ADMIN
    ):
        raise PermissionDenied("Solo un administrador activo puede gestionar usuarios.")


def ensure_active_admin_remains(profile, role, active):
    if profile.role == Profile.Role.ADMIN and profile.active and (
        role != Profile.Role.ADMIN or not active
    ):
        other_admins = Profile.objects.filter(
            role=Profile.Role.ADMIN, active=True, user__is_active=True
        ).exclude(pk=profile.pk)
        if not other_admins.exists():
            raise ValidationError("No se puede desactivar o degradar al último administrador activo.")


class UserManagementView(APIView):
    def get(self, request):
        require_active_admin(request)
        profiles = (
            Profile.objects.select_related("user", "farm")
            .filter(
                Q(pk=request.user.profile.pk)
                | Q(farm__owner=request.user.profile)
                | Q(created_by=request.user.profile)
            )
            .order_by("-created_at")
        )
        return Response([
            {
                "id": str(profile.pk),
                "email": profile.email,
                "full_name": profile.full_name,
                "role": profile.role,
                "active": profile.active,
                "created_by": str(profile.created_by_id) if profile.created_by_id else None,
                "farm_id": str(profile.farm_id) if profile.farm_id else None,
                "farm_name": profile.farm.name if profile.farm_id else None,
                "created_at": profile.created_at,
            }
            for profile in profiles
        ])

    def post(self, request):
        require_active_admin(request)
        email = str(request.data.get("email", "")).strip()
        full_name = str(request.data.get("full_name", "")).strip()
        role = request.data.get("role", Profile.Role.WORKER)
        active = request.data.get("active", True)
        password = request.data.get("password", "")
        farm_id = request.data.get("farm_id")
        photo_url = request.data.get("photo_url")
        if not email or not full_name or not isinstance(password, str) or not password:
            raise ValidationError("Correo, nombre y contraseña son obligatorios.")
        try:
            validate_email(email)
        except DjangoValidationError as error:
            raise ValidationError({"email": "Ingresa un correo electrónico válido."}) from error
        if len(full_name) > 200:
            raise ValidationError({"full_name": "El nombre no puede superar 200 caracteres."})
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError({"email": "Ya existe un usuario con ese correo."})
        if role not in Profile.Role.values:
            raise ValidationError({"role": "Rol no válido."})
        if not isinstance(active, bool):
            raise ValidationError({"active": "Debe ser un valor booleano."})
        farm = None
        if role == Profile.Role.WORKER:
            if not farm_id:
                raise ValidationError({"farm_id": "Selecciona la finca del trabajador."})
            try:
                farm = Farm.objects.get(pk=farm_id, owner=request.user.profile)
            except (Farm.DoesNotExist, ValueError, DjangoValidationError) as error:
                raise ValidationError({"farm_id": "Selecciona una finca de tu propiedad."}) from error
        elif farm_id:
            raise ValidationError({"farm_id": "Los administradores no se asignan como empleados."})
        validate_account_password(password)
        validate_image_data(photo_url, "photo_url")

        with transaction.atomic():
            user = User.objects.create_user(
                email=email,
                password=password,
                is_active=active,
                is_staff=role == Profile.Role.ADMIN,
            )
            profile = user.profile
            profile.email = user.email
            profile.full_name = full_name
            profile.role = role
            profile.active = active
            profile.created_by = request.user.profile
            profile.farm = farm
            profile.photo_url = photo_url
            profile.save(
                update_fields=(
                    "email", "full_name", "role", "active", "created_by", "farm", "photo_url"
                )
            )
            if role == Profile.Role.ADMIN:
                create_farm(profile, "Finca principal")
        return Response({
            "id": str(profile.pk),
            "email": profile.email,
            "full_name": profile.full_name,
            "role": profile.role,
            "active": profile.active,
            "created_by": str(profile.created_by_id),
            "farm_id": str(profile.farm_id) if profile.farm_id else None,
            "farm_name": profile.farm.name if profile.farm_id else None,
            "photo_url": profile.photo_url,
            "created_at": profile.created_at,
        }, status=status.HTTP_201_CREATED)


class UserManagementDetailView(APIView):
    def patch(self, request, profile_id):
        require_active_admin(request)
        with transaction.atomic():
            try:
                profile = (
                    Profile.objects.select_related("user", "farm")
                    .select_for_update(of=("self",))
                    .filter(
                        Q(pk=request.user.profile.pk)
                        | Q(farm__owner=request.user.profile)
                        | Q(created_by=request.user.profile)
                    )
                    .get(pk=profile_id)
                )
            except (Profile.DoesNotExist, ValueError):
                return Response({"detail": "Usuario no encontrado."}, status=status.HTTP_404_NOT_FOUND)

            full_name = request.data.get("full_name", profile.full_name)
            role = request.data.get("role", profile.role)
            active = request.data.get("active", profile.active)
            password = request.data.get("password")
            photo_url = request.data.get("photo_url", profile.photo_url)
            farm_id = request.data.get("farm_id", profile.farm_id)
            if not isinstance(full_name, str) or not full_name.strip():
                if "full_name" in request.data:
                    raise ValidationError({"full_name": "El nombre es obligatorio."})
            if len(full_name.strip()) > 200:
                raise ValidationError({"full_name": "El nombre no puede superar 200 caracteres."})
            if role not in Profile.Role.values:
                raise ValidationError({"role": "Rol no válido."})
            if not isinstance(active, bool):
                raise ValidationError({"active": "Debe ser un valor booleano."})
            farm = None
            if role == Profile.Role.WORKER:
                if not farm_id:
                    raise ValidationError({"farm_id": "Selecciona la finca del trabajador."})
                try:
                    farm = Farm.objects.get(pk=farm_id, owner=request.user.profile)
                except (Farm.DoesNotExist, ValueError, DjangoValidationError) as error:
                    raise ValidationError({"farm_id": "Selecciona una finca de tu propiedad."}) from error
            elif farm_id:
                raise ValidationError({"farm_id": "Los administradores no se asignan como empleados."})
            if profile.user.is_superuser and (role != Profile.Role.ADMIN or not active):
                raise ValidationError("No se puede desactivar ni degradar un superusuario Django.")
            validate_image_data(photo_url, "photo_url")
            if profile.role == Profile.Role.ADMIN and (
                role != Profile.Role.ADMIN or not active
            ) and profile.farms.exists():
                raise ValidationError(
                    "Transfiere las fincas antes de desactivar o degradar a este administrador."
                )
            ensure_active_admin_remains(profile, role, active)
            if password:
                if not isinstance(password, str):
                    raise ValidationError({"password": "La contraseña no es válida."})
                validate_account_password(password, user=profile.user)
                profile.user.set_password(password)
            profile.user.is_active = active
            profile.user.is_staff = role == Profile.Role.ADMIN
            profile.user.save()
            profile.full_name = full_name.strip()
            profile.role = role
            profile.active = active
            profile.farm = farm
            profile.photo_url = photo_url
            profile.save(update_fields=("full_name", "role", "active", "farm", "photo_url"))
        return Response({
            "id": str(profile.pk),
            "email": profile.email,
            "full_name": profile.full_name,
            "role": profile.role,
            "active": profile.active,
            "created_by": str(profile.created_by_id) if profile.created_by_id else None,
            "farm_id": str(profile.farm_id) if profile.farm_id else None,
            "farm_name": profile.farm.name if profile.farm_id else None,
            "photo_url": profile.photo_url,
            "created_at": profile.created_at,
        })

    def delete(self, request, profile_id):
        require_active_admin(request)
        with transaction.atomic():
            try:
                profile = (
                    Profile.objects.select_related("user", "farm")
                    .select_for_update(of=("self",))
                    .filter(
                        Q(pk=request.user.profile.pk)
                        | Q(farm__owner=request.user.profile)
                        | Q(created_by=request.user.profile)
                    )
                    .get(pk=profile_id)
                )
            except (Profile.DoesNotExist, ValueError):
                return Response({"detail": "Usuario no encontrado."}, status=status.HTTP_404_NOT_FOUND)
            if profile.pk == request.user.profile.pk:
                raise ValidationError("No puedes eliminar tu propio usuario.")
            if profile.user.is_superuser:
                raise ValidationError("No se puede eliminar un superusuario Django desde esta pantalla.")
            if profile.farms.exists():
                raise ValidationError(
                    "No se puede eliminar un administrador que tiene fincas asignadas."
                )
            ensure_active_admin_remains(profile, None, False)
            profile.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
