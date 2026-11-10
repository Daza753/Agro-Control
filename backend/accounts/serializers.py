from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from accounts.models import User


class CurrentUserSerializer(serializers.ModelSerializer):
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "is_staff", "is_superuser", "profile")

    def get_profile(self, user):
        profile = user.profile
        return {
            "id": str(profile.id),
            "full_name": profile.full_name,
            "role": profile.role,
            "active": profile.active,
            "farm_id": str(profile.farm_id) if profile.farm_id else None,
            "photo_url": profile.photo_url,
        }


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("La contraseña actual no es correcta.")
        return value

    def validate_new_password(self, value):
        validate_password(value, user=self.context["request"].user)
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user
