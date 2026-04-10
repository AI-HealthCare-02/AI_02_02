from fastapi import HTTPException, status
from tortoise.transactions import in_transaction

from backend.dtos.users import UserUpdateRequest
from backend.models.users import User
from backend.repositories.user_repository import UserRepository
from backend.services.auth import AuthService
from backend.utils.common import normalize_phone_number


class UserManageService:
    def __init__(self):
        self.repo = UserRepository()
        self.auth_service = AuthService()

    @staticmethod
    def _describe_account(user: User) -> str:
        if user.provider == "kakao":
            return "카카오 소셜 계정"
        if user.provider == "naver":
            return "네이버 소셜 계정"
        if user.provider == "google":
            return "구글 소셜 계정"
        if user.hashed_password:
            return "일반 이메일 계정"
        return "기존 계정"

    @staticmethod
    def _is_social_account(user: User) -> bool:
        return bool(user.provider)

    @staticmethod
    def _build_conflict_detail(field_name: str, conflict_user: User) -> dict[str, object]:
        account_type = UserManageService._describe_account(conflict_user)
        can_transfer = UserManageService._is_social_account(conflict_user)
        return {
            "code": f"{field_name}_conflict",
            "message": f"이 {field_name}은 이미 {account_type}에 연결돼 있습니다.",
            "conflict_account_type": account_type,
            "conflict_user_id": conflict_user.id,
            "can_transfer": can_transfer,
            "requires_manual_resolution": not can_transfer,
        }

    async def update_user(self, user: User, data: UserUpdateRequest) -> User:
        payload = data.model_dump(exclude_none=True)

        if payload.get("email"):
            normalized_email = str(payload["email"]).strip().lower()
            existing_email_users = await self.repo.get_users_by_email(normalized_email)
            existing_email_user = next((item for item in existing_email_users if item.id != user.id), None)
            if existing_email_user:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=self._build_conflict_detail("email", existing_email_user),
                )
            payload["email"] = normalized_email

        if payload.get("phone_number"):
            normalized_phone_number = normalize_phone_number(str(payload["phone_number"]))
            existing_phone_user = await self.repo.get_user_by_phone_number(normalized_phone_number)
            if existing_phone_user and existing_phone_user.id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=self._build_conflict_detail("phone_number", existing_phone_user),
                )
            payload["phone_number"] = normalized_phone_number

        async with in_transaction():
            await self.repo.update_instance(user=user, data=payload)
            await user.refresh_from_db()
        return user
