import json
import urllib.parse
from langchain_core.tools import tool
from config import SENSITIVE_FIELDS, CONFIRM_FIELDS, WARNING_BUTTONS


@tool
def navigate_to_url(url: str) -> str:
    """Navigate the browser to a URL. Only http/https allowed."""
    if not url.startswith(("http://", "https://")):
        return json.dumps({"error": "Only http/https URLs allowed"})
    return json.dumps({"action": "navigate", "url": url})


@tool
def google_search(query: str) -> str:
    """Search Google and navigate to results. Use when user wants to find something."""
    url = f"https://www.google.com/search?q={urllib.parse.quote(query)}"
    return json.dumps({"action": "navigate", "url": url, "search_query": query})


@tool
def fill_form_field(selector: str, value: str, field_type: str = "text") -> str:
    """Fill a form field. field_type determines guardrail level.
    SENSITIVE fields (password, otp, pin, credit_card, cvv, aadhaar): NEVER auto-fill.
    CONFIRM fields (name, email, phone, address): ask user first.
    Other fields: safe to fill."""
    field_type = field_type.lower()
    if field_type in SENSITIVE_FIELDS:
        return json.dumps({
            "action": "guardrail",
            "guardrail_type": "sensitive",
            "selector": selector,
            "field_type": field_type,
            "message": f"For your safety, I cannot fill {field_type} fields. Please type it yourself.",
            "severity": "high",
        })
    if field_type in CONFIRM_FIELDS:
        return json.dumps({
            "action": "confirm_fill",
            "selector": selector,
            "value": value,
            "field_type": field_type,
            "question": f"I'll fill {field_type} as '{value}'. Is that correct?",
        })
    return json.dumps({
        "action": "fill_field",
        "selector": selector,
        "value": value,
        "field_type": field_type,
    })


@tool
def click_element(selector: str, button_type: str = "normal") -> str:
    """Click an element. Payment/submit buttons need confirmation."""
    if button_type.lower() in WARNING_BUTTONS:
        return json.dumps({
            "action": "guardrail",
            "guardrail_type": "confirm_click",
            "selector": selector,
            "message": f"This looks like a {button_type} button. Are you sure you want to proceed?",
            "severity": "warning",
        })
    return json.dumps({"action": "click", "selector": selector})


@tool
def scan_for_scams(page_content: str) -> str:
    """Hybrid rule-based + contextual scam scanner. Returns risk level and flags."""
    text = page_content.lower()
    flags = []

    urgency_words = [
        "urgent", "immediately", "act now", "expire", "verify now",
        "last chance", "your account will be", "account suspended",
        "अभी करें", "तुरंत", "verify karo", "account band",
    ]
    for w in urgency_words:
        if w in text:
            flags.append(f"urgency: {w}")

    if "winner" in text or "congratulations" in text or "lottery" in text:
        flags.append("lottery/prize scam pattern")
    if "kyc" in text and ("update" in text or "verify" in text):
        flags.append("KYC update scam pattern")
    if "click here to claim" in text or "claim your prize" in text:
        flags.append("claim button scam")
    if "free" in text and ("iphone" in text or "laptop" in text or "₹" in text or "rs" in text):
        flags.append("too good to be true offer")
    if text.count("http") > 5:
        flags.append("suspicious number of links")

    risk = "high" if len(flags) > 2 else "medium" if flags else "low"
    return json.dumps({"risk_level": risk, "flags": flags, "count": len(flags)})


@tool
def ask_user(question: str) -> str:
    """Ask the user a question and wait for their response."""
    return json.dumps({"action": "ask_user", "question": question})


@tool
def show_warning(message: str, severity: str = "warning") -> str:
    """Display a warning banner on the page."""
    return json.dumps({"action": "show_warning", "message": message, "severity": severity})


@tool
def get_form_fields() -> str:
    """Request form fields from the page. Mobile app will run INJECT_GET_FORM_FIELDS."""
    return json.dumps({"action": "get_form_fields"})


ALL_TOOLS = [
    navigate_to_url, google_search, fill_form_field, click_element,
    scan_for_scams, ask_user, show_warning, get_form_fields,
]
