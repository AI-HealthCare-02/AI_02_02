import smtplib
from email.message import EmailMessage

from backend.core import config


class EmailService:
    def _is_configured(self) -> bool:
        required = [
            config.MAIL_FROM,
            config.SMTP_HOST,
            config.SMTP_USERNAME,
            config.SMTP_PASSWORD,
        ]
        return all(required)

    def _send_verification_code(self, *, to_email: str, subject: str, body: str) -> None:
        if not self._is_configured():
            raise RuntimeError("SMTP configuration is missing.")

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = config.MAIL_FROM
        message["To"] = to_email
        message.set_content(body)

        if config.SMTP_USE_SSL:
            with smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT, timeout=10) as smtp:
                smtp.login(config.SMTP_USERNAME, config.SMTP_PASSWORD)
                smtp.send_message(message)
            return

        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=10) as smtp:
            if config.SMTP_USE_TLS:
                smtp.starttls()
            smtp.login(config.SMTP_USERNAME, config.SMTP_PASSWORD)
            smtp.send_message(message)

    def send_signup_verification_code(self, *, to_email: str, code: str) -> None:
        self._send_verification_code(
            to_email=to_email,
            subject="[DA-NA-A] 이메일 회원가입 인증 코드",
            body=(
                "DA-NA-A 이메일 회원가입 인증 코드입니다.\n\n"
                f"인증 코드: {code}\n\n"
                "이 코드는 10분 동안만 유효합니다.\n"
                "만약 요청하지 않으셨다면 이 메일은 무시하셔도 됩니다.\n"
            ),
        )

    def send_email_link_verification_code(self, *, to_email: str, code: str) -> None:
        self._send_verification_code(
            to_email=to_email,
            subject="[DA-NA-A] 이메일 계정 연동 인증 코드",
            body=(
                "DA-NA-A 이메일 계정 연동 인증 코드입니다.\n\n"
                f"인증 코드: {code}\n\n"
                "이 코드는 10분 동안만 유효합니다.\n"
                "계정 연동을 요청하지 않으셨다면 이 메일은 무시하셔도 됩니다.\n"
            ),
        )
