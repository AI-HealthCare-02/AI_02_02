from enum import StrEnum

from tortoise import fields, models


class Gender(StrEnum):
    MALE = "MALE"
    FEMALE = "FEMALE"


class User(models.Model):
    id = fields.BigIntField(primary_key=True)
    provider = fields.CharField(max_length=20, null=True)
    provider_user_id = fields.CharField(max_length=128, null=True)
    email = fields.CharField(max_length=40, null=True)
    email_verified = fields.BooleanField(default=False)
    email_verified_at = fields.DatetimeField(null=True)
    hashed_password = fields.CharField(max_length=128, null=True)
    name = fields.CharField(max_length=20, null=True)
    gender = fields.CharEnumField(enum_type=Gender, null=True)
    birthday = fields.DateField(null=True)
    phone_number = fields.CharField(max_length=11, null=True)
    onboarding_completed = fields.BooleanField(default=False)
    onboarding_completed_at = fields.DatetimeField(null=True)
    profile_image = fields.TextField(null=True)
    is_active = fields.BooleanField(default=True)
    is_admin = fields.BooleanField(default=False)
    last_login = fields.DatetimeField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "users"
