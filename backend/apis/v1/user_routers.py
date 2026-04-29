import base64
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import ORJSONResponse as Response

from backend.dependencies.security import get_request_user
from backend.dtos.users import UserInfoResponse, UserMeasurementsUpdateRequest, UserUpdateRequest
from backend.models.users import User
from backend.services.users import UserManageService

_MAX_PROFILE_IMAGE_BYTES = 512 * 1024  # 512 KB
_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

user_router = APIRouter(prefix="/users", tags=["users"])


@user_router.get("/me", response_model=UserInfoResponse, status_code=status.HTTP_200_OK)
async def user_me_info(
    user: Annotated[User, Depends(get_request_user)],
) -> Response:
    return Response(
        UserInfoResponse.model_validate(user).model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@user_router.patch("/me", response_model=UserInfoResponse, status_code=status.HTTP_200_OK)
async def update_user_me_info(
    update_data: UserUpdateRequest,
    user: Annotated[User, Depends(get_request_user)],
    user_manage_service: Annotated[UserManageService, Depends(UserManageService)],
) -> Response:
    updated_user = await user_manage_service.update_user(user=user, data=update_data)
    return Response(
        UserInfoResponse.model_validate(updated_user).model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@user_router.patch("/me/measurements", status_code=status.HTTP_200_OK)
async def update_user_measurements(
    update_data: UserMeasurementsUpdateRequest,
    user: Annotated[User, Depends(get_request_user)],
) -> Response:
    """키·몸무게 업데이트 (BMI 자동 재계산)."""
    from backend.models.health import HealthProfile

    profile = await HealthProfile.get_or_none(user_id=user.id)

    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="건강 프로필이 없습니다. 온보딩을 먼저 완료해 주세요.")

    if update_data.height_cm is not None:
        profile.height_cm = update_data.height_cm
    if update_data.weight_kg is not None:
        profile.weight_kg = update_data.weight_kg

    profile.bmi = round(profile.weight_kg / (profile.height_cm / 100) ** 2, 1)
    await profile.save(update_fields=["height_cm", "weight_kg", "bmi"])

    return Response(
        {"height_cm": profile.height_cm, "weight_kg": profile.weight_kg, "bmi": profile.bmi},
        status_code=status.HTTP_200_OK,
    )


@user_router.put("/me/profile-image", response_model=UserInfoResponse, status_code=status.HTTP_200_OK)
async def upload_profile_image(
    file: UploadFile,
    user: Annotated[User, Depends(get_request_user)],
) -> Response:
    """프로필 이미지 업로드 (최대 512 KB, JPEG/PNG/WebP/GIF)."""
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"지원하지 않는 이미지 형식입니다. ({', '.join(_ALLOWED_CONTENT_TYPES)})",
        )

    raw = await file.read(_MAX_PROFILE_IMAGE_BYTES + 1)
    if len(raw) > _MAX_PROFILE_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="이미지 크기는 512 KB 이하여야 합니다.",
        )

    data_url = f"data:{file.content_type};base64,{base64.b64encode(raw).decode()}"
    user.profile_image = data_url
    await user.save(update_fields=["profile_image"])

    return Response(
        UserInfoResponse.model_validate(user).model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@user_router.delete("/me/profile-image", response_model=UserInfoResponse, status_code=status.HTTP_200_OK)
async def delete_profile_image(
    user: Annotated[User, Depends(get_request_user)],
) -> Response:
    """프로필 이미지 삭제."""
    user.profile_image = None
    await user.save(update_fields=["profile_image"])
    return Response(
        UserInfoResponse.model_validate(user).model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )
