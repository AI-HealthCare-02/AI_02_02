import hashlib
import secrets
import smtplib
from datetime import date, datetime, timedelta

import jwt
from fastapi.exceptions import HTTPException
from pydantic import EmailStr
from starlette import status
from tortoise.transactions import in_transaction

from backend.core import config
from backend.core.config import Env
from backend.core.jwt.tokens import AccessToken, RefreshToken
from backend.core.logger import setup_logger
from backend.dtos.auth import (
    AccountEmailConfirmRequest,
    AccountEmailVerificationRequest,
    EmailSignupConfirmRequest,
    EmailSignupVerificationRequest,
    LoginRequest,
    PasswordChangeRequest,
    SignUpRequest,
)
from backend.models.email_signup_sessions import EmailSignupSession
from backend.models.users import Gender, User
from backend.repositories.user_repository import UserRepository
from backend.services.email import EmailService
from backend.services.jwt import JwtService
from backend.utils.common import normalize_phone_number
from backend.utils.security import hash_password, verify_password

logger = setup_logger(__name__)


class AuthService:
    def __init__(self):
        self.user_repo = UserRepository()
        self.jwt_service = JwtService()
        self.email_service = EmailService()

    @staticmethod
    def _hash_verification_code(code: str) -> str:
        return hashlib.sha256(code.encode("utf-8")).hexdigest()

    @staticmethod
    def _generate_verification_code() -> str:
        return f"{secrets.randbelow(1_000_000):06d}"

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
    def _build_social_user_update_payload(
        *,
        social_user: User,
        email: str | None,
        name: str | None,
        gender: Gender | None,
        birthday: date | None,
        phone_number: str | None,
    ) -> dict:
        payload = {}
        if email and social_user.email != email:
            payload["email"] = email
        if email and not social_user.email_verified:
            payload["email_verified"] = True
            payload["email_verified_at"] = datetime.now(tz=config.TIMEZONE)
        if name and not social_user.name:
            payload["name"] = name
        if phone_number and not social_user.phone_number:
            payload["phone_number"] = phone_number
        if gender and not social_user.gender:
            payload["gender"] = gender
        if birthday and not social_user.birthday:
            payload["birthday"] = birthday
        return payload

    async def _sync_existing_social_user(
        self,
        *,
        social_user: User,
        email: str | None,
        name: str | None,
        gender: Gender | None,
        birthday: date | None,
        phone_number: str | None,
    ) -> User:
        payload = self._build_social_user_update_payload(
            social_user=social_user,
            email=email,
            name=name,
            gender=gender,
            birthday=birthday,
            phone_number=phone_number,
        )
        if payload:
            await self.user_repo.update_instance(social_user, payload)
            await social_user.refresh_from_db()
        return social_user

    async def _link_social_account_to_existing_user(
        self,
        *,
        existing_user: User,
        provider: str,
        provider_user_id: str,
        email: str | None,
        name: str | None,
        gender: Gender | None,
        birthday: date | None,
        phone_number: str | None,
    ) -> User:
        await self.user_repo.update_instance(
            existing_user,
            {
                "provider": provider,
                "provider_user_id": provider_user_id,
                "email": email,
                "name": existing_user.name or name or "Kakao User",
                "phone_number": existing_user.phone_number or phone_number,
                "gender": existing_user.gender or gender,
                "birthday": existing_user.birthday or birthday,
            },
        )
        return existing_user

    async def _create_social_user(
        self,
        *,
        provider: str,
        provider_user_id: str,
        email: str | None,
        name: str | None,
        gender: Gender | None,
        birthday: date | None,
        phone_number: str | None,
    ) -> User:
        return await self.user_repo.create_user(
            provider=provider,
            provider_user_id=provider_user_id,
            email=email,
            email_verified=bool(email),
            email_verified_at=datetime.now(tz=config.TIMEZONE) if email else None,
            hashed_password=None,
            name=name or "Kakao User",
            phone_number=phone_number,
            gender=gender,
            birthday=birthday,
        )

    def _send_verification_email(self, *, kind: str, to_email: str, code: str) -> bool:
        if not (
            config.MAIL_FROM
            and config.SMTP_HOST
            and config.SMTP_USERNAME
            and config.SMTP_PASSWORD
        ):
            if config.ENV == Env.PROD:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Email delivery is not configured.",
                )
            logger.warning("email_delivery_skipped_missing_smtp", kind=kind, to_email=to_email)
            return False

        try:
            if kind == "signup":
                self.email_service.send_signup_verification_code(to_email=to_email, code=code)
            else:
                self.email_service.send_email_link_verification_code(to_email=to_email, code=code)
        except smtplib.SMTPAuthenticationError as err:
            logger.exception("smtp_authentication_failed", kind=kind, to_email=to_email)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="SMTP authentication failed. Check the Gmail address and app password.",
            ) from err
        except (smtplib.SMTPException, OSError) as err:
            logger.exception("smtp_send_failed", kind=kind, to_email=to_email)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to send verification email. Check SMTP configuration and network access.",
            ) from err

        return True

    def _encode_email_link_token(
        self,
        *,
        email: str,
        requester_user_id: int,
        keep_user_id: int,
        candidate_user_ids: list[int],
        code_hash: str,
    ) -> str:
        now = datetime.now(tz=config.TIMEZONE)
        payload = {
            "iss": "danaa-email-link",
            "purpose": "email-link",
            "sub": str(requester_user_id),
            "requester_user_id": requester_user_id,
            "keep_user_id": keep_user_id,
            "candidate_user_ids": candidate_user_ids,
            "email": email,
            "code_hash": code_hash,
            "iat": now,
            "exp": now + timedelta(minutes=10),
        }
        return jwt.encode(payload, config.SECRET_KEY, algorithm=config.JWT_ALGORITHM)

    def _decode_email_link_token(self, token: str) -> dict:
        try:
            payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.JWT_ALGORITHM])
        except jwt.PyJWTError as err:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email link token.") from err
        if payload.get("purpose") != "email-link":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email link token.")
        return payload

    async def _get_password_user_by_email(self, email: str | EmailStr) -> User | None:
        accounts = await self.user_repo.get_users_by_email(str(email))
        password_accounts = [account for account in accounts if account.hashed_password]
        if not password_accounts:
            return None
        return max(password_accounts, key=lambda account: account.id)

    async def signup(self, data: SignUpRequest) -> User:
        await self.check_email_exists(data.email)
        normalized_phone_number = normalize_phone_number(data.phone_number)
        await self.check_phone_number_exists(normalized_phone_number)

        async with in_transaction():
            return await self.user_repo.create_user(
                email=data.email,
                hashed_password=hash_password(data.password),
                name=data.name,
                phone_number=normalized_phone_number,
                gender=data.gender,
                birthday=data.birth_date,
            )

    async def request_email_signup_verification(
        self, data: EmailSignupVerificationRequest
    ) -> dict[str, str | None]:
        existing_user = await self._get_password_user_by_email(str(data.email))
        if existing_user:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already in use.")
        verification_code = self._generate_verification_code()
        expires_at = datetime.now(tz=config.TIMEZONE) + timedelta(minutes=10)

        await EmailSignupSession.filter(email__iexact=data.email, consumed_at__isnull=True).delete()
        await EmailSignupSession.create(
            user_id=None,
            email=str(data.email),
            password_hash=hash_password(data.password),
            name=data.name,
            birthday=data.birth_date,
            verification_code_hash=self._hash_verification_code(verification_code),
            expires_at=expires_at,
        )

        mail_sent = self._send_verification_email(
            kind="signup",
            to_email=str(data.email),
            code=verification_code,
        )

        return {
            "detail": (
                "Verification code issued and email sent."
                if mail_sent
                else "Verification code issued. SMTP is not configured, use the dev verification code."
            ),
            "email_sent": mail_sent,
            "delivery_mode": "smtp" if mail_sent else "dev-code",
            "dev_verification_code": verification_code if config.ENV != Env.PROD else None,
        }

    async def preview_email_link(self, user: User, email: str) -> dict[str, object]:
        normalized_email = email.strip().lower()
        accounts = await self.user_repo.get_users_by_email(normalized_email)

        if not accounts:
            return {
                "detail": "No linked account exists for this email.",
                "accounts": [
                    {
                        "id": user.id,
                        "account_type": self._describe_account(user),
                        "name": user.name,
                        "email": user.email,
                        "provider": user.provider,
                        "email_verified": user.email_verified,
                        "created_at": user.created_at,
                        "is_current": True,
                    }
                ],
                "current_user_id": user.id,
                "current_account_type": self._describe_account(user),
                "conflict_user_ids": [],
                "can_transfer": True,
                "requires_manual_resolution": False,
                "selected_user_id": user.id,
            }

        items = []
        conflict_user_ids: list[int] = []
        for account in accounts:
            items.append(
                {
                    "id": account.id,
                    "account_type": self._describe_account(account),
                    "name": account.name,
                    "email": account.email,
                    "provider": account.provider,
                    "email_verified": account.email_verified,
                    "created_at": account.created_at,
                    "is_current": account.id == user.id,
                }
            )
            if account.id != user.id:
                conflict_user_ids.append(account.id)

        requires_manual_resolution = any(not self._is_social_account(account) and account.id != user.id for account in accounts)
        return {
            "detail": "Account link preview loaded.",
            "accounts": items,
            "current_user_id": user.id,
            "current_account_type": self._describe_account(user),
            "conflict_user_ids": conflict_user_ids,
            "can_transfer": True,
            "requires_manual_resolution": requires_manual_resolution,
            "selected_user_id": user.id,
        }

    async def request_email_link_verification(
        self,
        user: User,
        email: str,
        keep_user_id: int,
    ) -> dict[str, str | bool | None]:
        normalized_email = email.strip().lower()
        accounts = await self.user_repo.get_users_by_email(normalized_email)
        if not accounts:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked account not found.")

        keep_user = next((account for account in accounts if account.id == keep_user_id), None)
        if not keep_user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected account not found.")

        verification_code = self._generate_verification_code()
        code_hash = self._hash_verification_code(verification_code)
        link_token = self._encode_email_link_token(
            requester_user_id=user.id,
            email=normalized_email,
            keep_user_id=keep_user.id,
            candidate_user_ids=[account.id for account in accounts],
            code_hash=code_hash,
        )

        mail_sent = self._send_verification_email(
            kind="link",
            to_email=normalized_email,
            code=verification_code,
        )

        return {
            "detail": (
                "Verification code issued and email sent."
                if mail_sent
                else "Verification code issued. SMTP is not configured, use the dev verification code."
            ),
            "email_sent": mail_sent,
            "delivery_mode": "smtp" if mail_sent else "dev-code",
            "link_token": link_token,
            "selected_user_id": keep_user.id,
            "dev_verification_code": verification_code if config.ENV != Env.PROD else None,
        }

    async def confirm_email_signup_verification(self, data: EmailSignupConfirmRequest) -> User:
        session = (
            await EmailSignupSession.filter(email__iexact=data.email, consumed_at__isnull=True)
            .order_by("-created_at")
            .first()
        )
        if not session:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification session not found.")
        now = datetime.now(tz=config.TIMEZONE)
        if session.expires_at < now:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code expired.")
        if session.verification_code_hash != self._hash_verification_code(data.code):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code is invalid.")

        async with in_transaction():
            user = await self.user_repo.create_user(
                email=str(data.email),
                email_verified=True,
                email_verified_at=now,
                hashed_password=session.password_hash,
                name=session.name,
                birthday=session.birthday,
            )
            session.verified_at = now
            session.consumed_at = now
            await session.save(update_fields=["verified_at", "consumed_at", "updated_at"])
        return user

    async def request_account_email_verification(
        self,
        *,
        user: User,
        data: AccountEmailVerificationRequest,
    ) -> dict[str, str | bool | None]:
        normalized_email = str(data.email).strip().lower()
        existing_users = await self.user_repo.get_users_by_email(normalized_email)
        conflict_user = next((item for item in existing_users if item.id != user.id), None)
        if conflict_user:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already in use.")

        verification_code = self._generate_verification_code()
        expires_at = datetime.now(tz=config.TIMEZONE) + timedelta(minutes=10)

        await EmailSignupSession.filter(user_id=user.id, consumed_at__isnull=True).delete()
        await EmailSignupSession.create(
            user_id=user.id,
            email=normalized_email,
            password_hash=hash_password(secrets.token_urlsafe(16)),
            name=user.name or "User",
            birthday=user.birthday,
            verification_code_hash=self._hash_verification_code(verification_code),
            expires_at=expires_at,
        )

        mail_sent = self._send_verification_email(
            kind="signup",
            to_email=normalized_email,
            code=verification_code,
        )

        return {
            "detail": (
                "Verification code issued and email sent."
                if mail_sent
                else "Verification code issued. SMTP is not configured, use the dev verification code."
            ),
            "email_sent": mail_sent,
            "delivery_mode": "smtp" if mail_sent else "dev-code",
            "dev_verification_code": verification_code if config.ENV != Env.PROD else None,
        }

    async def confirm_account_email_verification(
        self,
        *,
        user: User,
        data: AccountEmailConfirmRequest,
    ) -> User:
        normalized_email = str(data.email).strip().lower()
        existing_users = await self.user_repo.get_users_by_email(normalized_email)
        conflict_user = next((item for item in existing_users if item.id != user.id), None)
        if conflict_user:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already in use.")

        session = (
            await EmailSignupSession.filter(
                user_id=user.id,
                email__iexact=normalized_email,
                consumed_at__isnull=True,
            )
            .order_by("-created_at")
            .first()
        )
        if not session:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification session not found.")

        now = datetime.now(tz=config.TIMEZONE)
        if session.expires_at < now:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code expired.")
        if session.verification_code_hash != self._hash_verification_code(data.code):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code is invalid.")

        async with in_transaction():
            await self.user_repo.update_instance(
                user,
                {
                    "email": normalized_email,
                    "email_verified": True,
                    "email_verified_at": now,
                },
            )
            session.verified_at = now
            session.consumed_at = now
            await session.save(update_fields=["verified_at", "consumed_at", "updated_at"])

        await user.refresh_from_db()
        return user

    async def confirm_email_link_verification(
        self,
        user: User,
        email: str,
        code: str,
        link_token: str,
        keep_user_id: int | None = None,
    ) -> tuple[User, dict[str, str | None]]:
        normalized_email = email.strip().lower()
        payload = self._decode_email_link_token(link_token)
        if int(payload.get("requester_user_id") or 0) != user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email link token does not match user.")
        if payload.get("email") != normalized_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email link token does not match email.")
        if payload.get("code_hash") != self._hash_verification_code(code):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code is invalid.")

        selected_keep_user_id = keep_user_id or int(payload.get("keep_user_id") or 0)
        if not selected_keep_user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected account is missing.")

        candidate_user_ids = {int(uid) for uid in (payload.get("candidate_user_ids") or [])}
        if selected_keep_user_id not in candidate_user_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected account is not available.")

        accounts = await self.user_repo.get_users_by_email(normalized_email)
        keep_user = next((account for account in accounts if account.id == selected_keep_user_id), None)
        if not keep_user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected account not found.")

        now = datetime.now(tz=config.TIMEZONE)
        async with in_transaction():
            for account in accounts:
                if account.id == keep_user.id:
                    continue
                await account.delete()

            await self.user_repo.update_instance(
                keep_user,
                {
                    "email": normalized_email,
                    "email_verified": True,
                    "email_verified_at": now,
                },
            )

        tokens = await self.login(keep_user)
        return keep_user, {
            "access_token": str(tokens["access_token"]),
            "refresh_token": str(tokens["refresh_token"]),
        }

    async def get_or_create_social_user(
        self,
        *,
        provider: str,
        provider_user_id: str,
        email: str | None = None,
        name: str | None = None,
        gender: Gender | None = None,
        birthday: date | None = None,
        phone_number: str | None = None,
    ) -> User:
        social_user = await self.user_repo.get_user_by_provider(provider, provider_user_id)
        if social_user:
            return await self._sync_existing_social_user(
                social_user=social_user,
                email=email,
                name=name,
                gender=gender,
                birthday=birthday,
                phone_number=phone_number,
            )

        existing_user = None
        if email:
            existing_user = await self.user_repo.get_user_by_email(str(email))

        async with in_transaction():
            if existing_user:
                return await self._link_social_account_to_existing_user(
                    existing_user=existing_user,
                    provider=provider,
                    provider_user_id=provider_user_id,
                    email=email,
                    name=name,
                    gender=gender,
                    birthday=birthday,
                    phone_number=phone_number,
                )

            return await self._create_social_user(
                provider=provider,
                provider_user_id=provider_user_id,
                email=email,
                name=name,
                gender=gender,
                birthday=birthday,
                phone_number=phone_number,
            )

    async def authenticate(self, data: LoginRequest) -> User:
        email = str(data.email)
        user = await self._get_password_user_by_email(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email or password is invalid.",
            )
        if not user.hashed_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Social account cannot use password login.",
            )
        if not verify_password(data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email or password is invalid.",
            )
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="Account is locked.")
        return user

    async def login(self, user: User) -> dict[str, AccessToken | RefreshToken]:
        await self.user_repo.update_last_login(user.id)
        return self.jwt_service.issue_jwt_pair(user)

    async def check_email_exists(self, email: str | EmailStr) -> None:
        if await self._get_password_user_by_email(email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already in use.")

    async def check_phone_number_exists(self, phone_number: str) -> None:
        if await self.user_repo.exists_by_phone_number(phone_number):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Phone number is already in use.")

    async def change_password(self, *, user: User, data: PasswordChangeRequest) -> None:
        if not user.hashed_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This account does not support password change yet.",
            )

        if not verify_password(data.current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect.",
            )

        await self.user_repo.update_instance(
            user,
            {
                "hashed_password": hash_password(data.new_password),
            },
        )
