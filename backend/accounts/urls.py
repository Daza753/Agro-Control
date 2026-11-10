from django.urls import path
from accounts.views import (
    CurrentUserView,
    FarmDetailView,
    FarmsView,
    LoginView,
    PasswordChangeView,
    RefreshTokenView,
    UserManagementDetailView,
    UserManagementView,
)


app_name = "accounts"

urlpatterns = [
    path("farms/", FarmsView.as_view(), name="farms"),
    path("farms/<uuid:farm_id>/", FarmDetailView.as_view(), name="farm-detail"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshTokenView.as_view(), name="refresh"),
    path("me/", CurrentUserView.as_view(), name="me"),
    path("password/change/", PasswordChangeView.as_view(), name="password-change"),
    path("users/", UserManagementView.as_view(), name="users"),
    path("users/<uuid:profile_id>/", UserManagementDetailView.as_view(), name="user-detail"),
]
