from datetime import date
from typing import Annotated

from pydantic import AfterValidator, BaseModel, EmailStr, Field

from app.models.users import Gender
from app.validators.user_validators import validate_birthday, validate_password, validate_phone_number


class SignUpRequest(BaseModel):
    model_config = {"json_schema_extra": {"example": {
        "email": "swagger@danaa.com",
        "password": "Test1234!@",
        "name": "홍길동",
        "gender": "MALE",
        "birth_date": "1990-01-01",
        "phone_number": "010-9876-5432",
    }}}

    email: Annotated[
        EmailStr,
        Field(None, max_length=40),
    ]
    password: Annotated[str, Field(min_length=8), AfterValidator(validate_password)]
    name: Annotated[str, Field(max_length=20)]
    gender: Gender
    birth_date: Annotated[date, AfterValidator(validate_birthday)]
    phone_number: Annotated[str, AfterValidator(validate_phone_number)]


class LoginRequest(BaseModel):
    model_config = {"json_schema_extra": {"example": {
        "email": "swagger@danaa.com",
        "password": "Test1234!@",
    }}}

    email: EmailStr
    password: Annotated[str, Field(min_length=8)]


class LoginResponse(BaseModel):
    access_token: str


class TokenRefreshResponse(LoginResponse): ...
