from app.english.ielts.verifier import IeltsVerifier, get_ielts_verifier
from app.english.infra.asr import ASRClient, get_asr_client
from app.english.infra.languagetool import LanguageToolClient, get_languagetool_client
from app.english.infra.llm import LLMClient, get_llm_client
from app.english.infra.storage import Storage, get_storage
from app.english.infra.webhook import WebhookSender, get_webhook_sender
from app.infrastructure.database import get_session

get_db = get_session


def get_verifier() -> IeltsVerifier:
    return get_ielts_verifier()


def get_llm() -> LLMClient:
    return get_llm_client()


def get_asr() -> ASRClient:
    return get_asr_client()


def get_languagetool() -> LanguageToolClient:
    return get_languagetool_client()


def get_webhook() -> WebhookSender:
    return get_webhook_sender()


def get_storage_dep() -> Storage:
    return get_storage()
