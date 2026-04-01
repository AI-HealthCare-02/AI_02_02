from pydantic import BaseModel


class ClientChannelContext(BaseModel):
    channel: str
    app_version: str | None = None
    device_os: str | None = None
    locale: str | None = None
