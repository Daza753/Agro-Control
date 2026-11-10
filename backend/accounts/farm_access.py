from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import Farm, Profile


def get_request_farm(request):
    profile = request.user.profile
    if profile.role == Profile.Role.ADMIN:
        farm_id = request.headers.get("X-Farm-ID")
        if not farm_id:
            raise ValidationError({"farm_id": "Selecciona una finca para continuar."})
        try:
            farm = Farm.objects.filter(owner=profile).get(pk=farm_id)
        except (Farm.DoesNotExist, ValueError, DjangoValidationError) as error:
            raise PermissionDenied("No tienes acceso a esa finca.") from error
        return farm

    if not profile.farm_id:
        raise PermissionDenied("Tu usuario no está asignado a una finca.")
    return profile.farm
