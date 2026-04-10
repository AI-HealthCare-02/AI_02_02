from datetime import date, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, EmailStr, Field

from backend.dtos.users import UserInfoResponse
from backend.models.users import Gender
from backend.validators.user_validators import validate_birthday, validate_password, validate_phone_number


class SignUpRequest(BaseModel):
    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "swagger@danaa.com",
                "password": "Test1234!@",
                "name": "Hong Gildong",
                "gender": "MALE",
                "birth_date": "1990-01-01",
                "phone_number": "010-9876-5432",
            }
        }
    }

    email: Annotated[EmailStr, Field(max_length=40)]
    password: Annotated[str, Field(min_length=8), AfterValidator(validate_password)]
    name: Annotated[str, Field(max_length=20)]
    gender: Gender
    birth_date: Annotated[date, AfterValidator(validate_birthday)]
    phone_number: Annotated[str, AfterValidator(validate_phone_number)]


class LoginRequest(BaseModel):
    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "swagger@danaa.com",
                "password": "Test1234!@",
            }
        }
    }

    email: EmailStr
    password: Annotated[str, Field(min_length=8)]


class LoginResponse(BaseModel):
    access_token: str


class TokenRefreshResponse(LoginResponse):
    ...


class EmailSignupVerificationRequest(BaseModel):
    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "signup@example.com",
                "password": "Test1234!@",
                "name": "Hong Gildong",
                "birth_date": "1990-01-01",
            }
        }
    }

    email: Annotated[EmailStr, Field(max_length=40)]
    password: Annotated[str, Field(min_length=8), AfterValidator(validate_password)]
    name: Annotated[str, Field(max_length=20)]
    birth_date: Annotated[date, AfterValidator(validate_birthday)]


class EmailSignupConfirmRequest(BaseModel):
    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "signup@example.com",
                "code": "123456",
            }
        }
    }

    email: EmailStr
    code: Annotated[str, Field(min_length=6, max_length=6)]


class EmailLinkVerificationRequest(BaseModel):
    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "linked@example.com",
            }
        }
    }

    email: Annotated[EmailStr, Field(max_length=40)]
    keep_user_id: int | None = None


class EmailLinkPreviewResponse(BaseModel):
    id: int
    account_type: str
    name: str | None = None
    email: str | None = None
    provider: str | None = None
    email_verified: bool = False
    created_at: datetime
    is_current: bool = False


class EmailLinkPreviewListResponse(BaseModel):
    detail: str
    accounts: list[EmailLinkPreviewResponse]
    current_user_id: int
    current_account_type: str
    conflict_user_ids: list[int] = []
    can_transfer: bool = False
    requires_manual_resolution: bool = False
    selected_user_id: int | None = None


class EmailLinkConfirmRequest(BaseModel):
    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "linked@example.com",
                "code": "123456",
                "link_token": "eyJhbGciOiJIUzI1NiIs...",
            }
        }
    }

    email: EmailStr
    code: Annotated[str, Field(min_length=6, max_length=6)]
    link_token: str
    keep_user_id: int | None = None


class EmailLinkConfirmResponse(BaseModel):
    detail: str
    access_token: str
    user: UserInfoResponse


class EmailSignupVerificationResponse(BaseModel):
    detail: str
    dev_verification_code: str | None = None


class EmailLinkVerificationResponse(BaseModel):
    detail: str
    link_token: str | None = None
    conflict_account_type: str | None = None
    can_transfer: bool = False
    requires_manual_resolution: bool = False
    dev_verification_code: str | None = None
