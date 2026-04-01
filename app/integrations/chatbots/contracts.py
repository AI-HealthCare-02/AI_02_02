from pydantic import BaseModel


class ChatbotWebhookPayload(BaseModel):
    provider: str
    event_type: str
    user_external_id: str
    payload: dict
