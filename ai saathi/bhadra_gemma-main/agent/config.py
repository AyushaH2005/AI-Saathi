import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL_NAME = os.getenv("MODEL_NAME", "gemma-4-31b-it")
AGENT_PORT = int(os.getenv("AGENT_PORT", "8000"))
MAX_PAGE_CONTENT = 8000

# Guardrail field classifications
SENSITIVE_FIELDS = {"password", "credit_card", "cvv", "otp", "pin", "aadhaar"}
CONFIRM_FIELDS = {"name", "email", "phone", "address"}
WARNING_BUTTONS = {"payment", "submit", "buy", "checkout", "pay"}
