import json
import re
from typing import TypedDict
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from config import GEMINI_API_KEY, MODEL_NAME, MAX_PAGE_CONTENT, SENSITIVE_FIELDS, CONFIRM_FIELDS
from prompts import (
    INTENT_CLASSIFICATION_PROMPT, MODE_PROMPTS, get_general_prompt,
    get_fill_form_prompt, PAGE_ANALYSIS_PROMPT,
)

# ANSI color codes for terminal logging
C = {
    "BLUE": "\033[94m", "YELLOW": "\033[93m", "GREEN": "\033[92m",
    "ORANGE": "\033[33m", "WHITE": "\033[97m", "RED": "\033[91m",
    "CYAN": "\033[96m", "DIM": "\033[90m", "BOLD": "\033[1m",
    "RESET": "\033[0m",
}


def _log(icon, color, label, msg):
    print(f"{color}{icon} {label:<10}{C['RESET']} {msg}")


class AgentState(TypedDict):
    user_input: str
    page_text: str
    page_url: str
    page_title: str
    language: str
    intent: str
    confidence: float
    response_text: str
    tts_text: str
    actions: list[dict]
    guardrails: list[dict]
    conversation_history: list[dict]
    extracted_query: str
    needs_clarification: bool
    clarification_question: str


llm = ChatGoogleGenerativeAI(
    model=MODEL_NAME,
    google_api_key=GEMINI_API_KEY,
    temperature=0.4,
    max_output_tokens=1024,
)

llm_precise = ChatGoogleGenerativeAI(
    model=MODEL_NAME,
    google_api_key=GEMINI_API_KEY,
    temperature=0.0,
    max_output_tokens=256,
)


def _build_messages(system_prompt: str, state: AgentState, extra: str = "") -> list:
    """Build message list with system prompt + conversation history + current input."""
    messages = [SystemMessage(content=system_prompt)]
    for entry in state.get("conversation_history", [])[-6:]:
        if entry["role"] == "user":
            messages.append(HumanMessage(content=entry["text"]))
        elif entry["role"] == "assistant":
            messages.append(AIMessage(content=entry["text"]))
    content = state.get("page_text", "")[:MAX_PAGE_CONTENT]
    user_msg = state["user_input"]
    if content:
        user_msg = f"[PAGE CONTENT]\n{content}\n[/PAGE CONTENT]\n\n{user_msg}"
    if extra:
        user_msg = f"{user_msg}\n\n{extra}"
    messages.append(HumanMessage(content=user_msg))
    return messages


def _get_text(response) -> str:
    """Extract text from LLM response, handling list content and thinking blocks."""
    content = response.content
    if isinstance(content, list):
        parts = []
        for c in content:
            if isinstance(c, dict):
                # Skip thinking blocks
                if c.get("type") == "thinking":
                    continue
                parts.append(c.get("text", str(c)))
            else:
                parts.append(str(c))
        return "".join(parts)
    return str(content)


def understand_intent(state: AgentState) -> dict:
    user_input = state["user_input"]

    # Route __page_loaded__ directly to page_loaded node
    if user_input == "__page_loaded__":
        _log("🔵", C["BLUE"], "REQUEST", "Page loaded — checking what to do next")
        return {
            "intent": "page_loaded",
            "language": state.get("language", "hi"),
            "confidence": 1.0,
            "extracted_query": "",
        }

    _log("🔵", C["BLUE"], "REQUEST", f'User said: "{user_input}"')

    # Build classification prompt with conversation context
    history_text = ""
    for entry in state.get("conversation_history", [])[-4:]:
        role = "User" if entry["role"] == "user" else "Assistant"
        history_text += f"{role}: {entry['text']}\n"

    prompt = INTENT_CLASSIFICATION_PROMPT.format(
        user_input=state["user_input"],
        page_title=state.get("page_title", ""),
        page_url=state.get("page_url", ""),
    )
    if history_text:
        prompt += f"\n\nConversation so far:\n{history_text}"

    response = llm_precise.invoke([HumanMessage(content=prompt)])
    try:
        text = _get_text(response).strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        parsed = json.loads(text)
        intent = parsed.get("intent", "general")
        language = parsed.get("language", "hi")
        confidence = parsed.get("confidence", 0.5)
        extracted_query = parsed.get("extracted_query", "")
        needs_clarification = parsed.get("needs_clarification", False)
        clarification_question = parsed.get("clarification_question", "")
    except (json.JSONDecodeError, AttributeError):
        intent = "general"
        language = "hi"
        confidence = 0.5
        extracted_query = ""
        needs_clarification = False
        clarification_question = ""

    if confidence < 0.5:
        intent = "general"

    _log("🟡", C["YELLOW"], "INTENT", f"Detected: {intent} ({language}) — confidence: {confidence}")
    if extracted_query:
        _log("  ", C["DIM"], "QUERY", extracted_query)
    if needs_clarification:
        _log("❓", C["CYAN"], "CLARIFY", clarification_question)

    return {
        "intent": intent,
        "language": language,
        "confidence": confidence,
        "extracted_query": extracted_query,
        "needs_clarification": needs_clarification,
        "clarification_question": clarification_question,
    }


def generate_explanation(state: AgentState) -> dict:
    _log("🟢", C["GREEN"], "NODE", "explain")
    lang = state.get("language", "hi")
    prompt = MODE_PROMPTS["explain"](lang)
    messages = _build_messages(prompt, state)
    response = llm.invoke(messages)
    return {"response_text": _get_text(response)}


def simplify_content(state: AgentState) -> dict:
    _log("🟢", C["GREEN"], "NODE", "simplify")
    lang = state.get("language", "hi")
    prompt = MODE_PROMPTS["simplify"](lang)
    messages = _build_messages(prompt, state)
    response = llm.invoke(messages)
    return {"response_text": _get_text(response)}


def check_scams(state: AgentState) -> dict:
    _log("🟢", C["GREEN"], "NODE", "scam_check")
    lang = state.get("language", "hi")
    prompt = MODE_PROMPTS["scam_check"](lang)
    content = state.get("page_text", "")[:MAX_PAGE_CONTENT].lower()
    messages = _build_messages(prompt, state)
    response = llm.invoke(messages)
    response_text = _get_text(response)

    actions = []
    text_lower = response_text.lower()
    if "likely scam" in text_lower or "do not proceed" in text_lower:
        actions.append({
            "action": "show_warning",
            "message": "WARNING: This page may be a scam! Do NOT enter any personal information.",
            "severity": "high",
        })
        actions.append({"action": "block_form_submission"})
    elif "caution" in text_lower:
        actions.append({
            "action": "show_warning",
            "message": "Caution: Some suspicious elements found. Be careful.",
            "severity": "warning",
        })

    return {"response_text": response_text, "actions": actions}


def generate_guide(state: AgentState) -> dict:
    _log("🟢", C["GREEN"], "NODE", "guide")
    lang = state.get("language", "hi")
    prompt = MODE_PROMPTS["guide"](lang)
    messages = _build_messages(prompt, state)
    response = llm.invoke(messages)
    return {"response_text": _get_text(response)}


def handle_navigation(state: AgentState) -> dict:
    _log("🟢", C["GREEN"], "NODE", "navigate")

    # If clarification is needed, ask and don't navigate
    if state.get("needs_clarification") and state.get("clarification_question"):
        question = state["clarification_question"]
        _log("❓", C["CYAN"], "ASKING", question)
        return {
            "response_text": question,
            "actions": [],
        }

    # Build search query from conversation context + current input
    query = state.get("extracted_query", "") or state["user_input"]

    # Use LLM to build a better search query from conversation history
    history = state.get("conversation_history", [])
    if history:
        recent = "\n".join(f"{'User' if h['role']=='user' else 'Assistant'}: {h['text']}" for h in history[-4:])
        refine_prompt = f"""Given this conversation, what should I search on Google to help the user?
Only reply with the search query, nothing else. Keep it short (under 8 words).

Conversation:
{recent}

User now said: {query}"""
        try:
            refined = llm_precise.invoke([HumanMessage(content=refine_prompt)])
            refined_text = _get_text(refined).strip().strip('"').strip("'")
            if refined_text and len(refined_text) < 100:
                query = refined_text
                _log("  ", C["DIM"], "REFINED", f"Query refined to: {query}")
        except Exception:
            pass

    import urllib.parse
    url = f"https://www.google.com/search?q={urllib.parse.quote(query)}"
    lang = state.get("language", "hi")
    _log("🟠", C["ORANGE"], "ACTION", f"[navigate] {url}")

    messages = {
        "hi": f"खोज रहा हूं: {query}",
        "ta": f"தேடுகிறேன்: {query}",
        "bn": f"খুঁজছি: {query}",
        "mr": f"शोधत आहे: {query}",
    }
    message = messages.get(lang, f"Searching for: {query}")

    return {
        "response_text": message,
        "actions": [{"action": "navigate", "url": url, "auto_follow_up": True}],
    }


def handle_fill_form(state: AgentState) -> dict:
    """Handle form filling with strict guardrails."""
    _log("🟢", C["GREEN"], "NODE", "fill_form")
    lang = state.get("language", "hi")
    content = state.get("page_text", "")[:MAX_PAGE_CONTENT]

    prompt = get_fill_form_prompt(lang)
    messages = [SystemMessage(content=prompt)]
    messages.append(HumanMessage(content=content))

    response = llm_precise.invoke(messages)

    try:
        raw = _get_text(response).strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        fields = json.loads(raw)
        if not isinstance(fields, list):
            fields = []
    except (json.JSONDecodeError, AttributeError):
        fields = []

    guardrails = []
    actions = []
    ask_messages = {
        "hi": {"name": "आपका नाम क्या है?", "email": "आपका ईमेल पता क्या है?",
                "phone": "आपका फोन नंबर क्या है?", "address": "आपका पता क्या है?",
                "password": "सुरक्षा के लिए, कृपया पासवर्ड खुद टाइप करें। मैं पासवर्ड नहीं भर सकता।",
                "otp": "OTP आपको मिलेगा — कृपया खुद डालें। मैं OTP नहीं भर सकता।",
                "pin": "सुरक्षा के लिए, कृपया PIN खुद टाइप करें।",
                "cvv": "सुरक्षा के लिए, कृपया CVV खुद टाइप करें।",
                "credit_card": "सुरक्षा के लिए, कृपया कार्ड नंबर खुद टाइप करें।",
                "aadhaar": "सुरक्षा के लिए, कृपया आधार नंबर खुद टाइप करें।"},
        "en": {"name": "What is your name?", "email": "What is your email address?",
                "phone": "What is your phone number?", "address": "What is your address?",
                "password": "For your safety, please type your password yourself. I cannot fill passwords.",
                "otp": "You'll receive an OTP — please enter it yourself. I cannot fill OTPs.",
                "pin": "For your safety, please type your PIN yourself.",
                "cvv": "For your safety, please type your CVV yourself.",
                "credit_card": "For your safety, please type your card number yourself.",
                "aadhaar": "For your safety, please type your Aadhaar number yourself."},
    }
    msgs = ask_messages.get(lang, ask_messages["en"])

    for field in fields:
        field_type = field.get("type", "text").lower()
        selector = field.get("selector", "")
        label = field.get("label", field_type)

        if field_type in SENSITIVE_FIELDS:
            guardrails.append({
                "action": "guardrail_block",
                "field": selector,
                "field_type": field_type,
                "label": label,
                "message": msgs.get(field_type, f"For your safety, please type your {label} yourself."),
                "severity": "high",
            })
        elif field_type in CONFIRM_FIELDS:
            question = msgs.get(field_type, f"What should I fill for {label}?")
            guardrails.append({
                "action": "confirm_fill",
                "field": selector,
                "field_type": field_type,
                "label": label,
                "question": question,
                "severity": "medium",
            })
        else:
            actions.append({
                "action": "fill_field",
                "selector": selector,
                "field_type": field_type,
                "label": label,
            })

    intro = {
        "hi": "मैं इस फॉर्म को भरने में मदद करूंगा। पहले कुछ जानकारी चाहिए:",
        "ta": "இந்த படிவத்தை நிரப்ப உதவுகிறேன். சில தகவல்கள் தேவை:",
        "bn": "আমি এই ফর্ম পূরণ করতে সাহায্য করব। কিছু তথ্য দরকার:",
        "mr": "मी या फॉर्मची मदत करतो. काही माहिती हवी:",
        "en": "I'll help you fill this form. I need some information first:",
    }

    text = intro.get(lang, intro["en"])

    blocked = [g for g in guardrails if g["action"] == "guardrail_block"]
    if blocked:
        block_text = {
            "hi": f"\n\n⚠️ {len(blocked)} फील्ड मैं नहीं भर सकता (पासवर्ड/OTP/PIN आदि) — कृपया वे खुद भरें।",
            "en": f"\n\n⚠️ {len(blocked)} field(s) I cannot fill (password/OTP/PIN etc.) — please fill those yourself.",
        }
        text += block_text.get(lang, block_text["en"])

    confirm = [g for g in guardrails if g["action"] == "confirm_fill"]
    if confirm:
        for g in confirm:
            text += f"\n\n• {g['question']}"

    return {
        "response_text": text,
        "guardrails": guardrails,
        "actions": [{"action": "get_form_fields"}] + actions,
    }


def generate_general_response(state: AgentState) -> dict:
    _log("🟢", C["GREEN"], "NODE", "general")
    lang = state.get("language", "hi")
    prompt = get_general_prompt(lang)
    messages = _build_messages(prompt, state)
    response = llm.invoke(messages)
    return {"response_text": _get_text(response)}


def handle_page_loaded(state: AgentState) -> dict:
    """Analyze page after navigation — click links or ask follow-up questions."""
    _log("🟢", C["GREEN"], "NODE", "page_loaded")
    page_text = state.get("page_text", "")[:MAX_PAGE_CONTENT]
    page_url = state.get("page_url", "")
    lang = state.get("language", "hi")

    if not page_text:
        _log("  ", C["DIM"], "SKIP", "No page content to analyze")
        return {"response_text": "", "actions": []}

    # Build conversation context
    history = state.get("conversation_history", [])
    context_lines = []
    for h in history[-6:]:
        role = "User" if h["role"] == "user" else "Assistant"
        context_lines.append(f"{role}: {h['text']}")
    conversation_context = "\n".join(context_lines)

    prompt = PAGE_ANALYSIS_PROMPT.format(conversation_context=conversation_context)
    user_msg = f"[PAGE URL]\n{page_url}\n[/PAGE URL]\n\n[PAGE CONTENT]\n{page_text}\n[/PAGE CONTENT]"
    messages = [SystemMessage(content=prompt), HumanMessage(content=user_msg)]

    response = llm_precise.invoke(messages)

    try:
        raw = _get_text(response).strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        parsed = json.loads(raw)
        action_type = parsed.get("action", "ask")
        message = parsed.get("message", "")
        link_text = parsed.get("link_text", "")
    except (json.JSONDecodeError, AttributeError):
        action_type = "ask"
        message = "पेज लोड हो गया। आप क्या करना चाहते हैं?" if lang == "hi" else "Page loaded. What would you like to do?"
        link_text = ""

    actions = []
    if action_type == "click_link" and link_text:
        actions.append({"action": "click_link", "link_text": link_text, "auto_follow_up": True})
        _log("🟠", C["ORANGE"], "ACTION", f"[click_link] {link_text}")
    elif action_type == "click_link":
        # LLM didn't return link_text, fall back to asking
        action_type = "ask"

    _log("💬", C["CYAN"], "SAY", message)
    return {"response_text": message, "actions": actions}


def format_for_tts(state: AgentState) -> dict:
    _log("⚪", C["WHITE"], "TTS", "Formatting response for speech")
    text = state.get("response_text", "")
    if isinstance(text, list):
        text = " ".join(str(t) for t in text)
    text = str(text)
    clean = text.split("---ANNOTATIONS---")[0]
    clean = re.sub(r'\[\d+\]', '', clean)
    clean = re.sub(r'\*{1,2}([^*]+)\*{1,2}', r'\1', clean)
    clean = re.sub(r'#{1,6}\s+', '', clean)
    clean = re.sub(r'```[\s\S]*?```', '', clean)
    clean = clean.strip()
    return {"tts_text": clean}


def route_by_intent(state: AgentState) -> str:
    return state.get("intent", "general")


graph = StateGraph(AgentState)

graph.add_node("understand_intent", understand_intent)
graph.add_node("explain", generate_explanation)
graph.add_node("simplify", simplify_content)
graph.add_node("scam_check", check_scams)
graph.add_node("guide", generate_guide)
graph.add_node("navigate", handle_navigation)
graph.add_node("fill_form", handle_fill_form)
graph.add_node("general", generate_general_response)
graph.add_node("page_loaded", handle_page_loaded)
graph.add_node("format_tts", format_for_tts)

graph.set_entry_point("understand_intent")

graph.add_conditional_edges(
    "understand_intent",
    route_by_intent,
    {
        "explain": "explain",
        "simplify": "simplify",
        "scam_check": "scam_check",
        "guide": "guide",
        "navigate": "navigate",
        "fill_form": "fill_form",
        "click_element": "fill_form",
        "general": "general",
        "page_loaded": "page_loaded",
    },
)

for node in ["explain", "simplify", "scam_check", "guide", "navigate", "fill_form", "general", "page_loaded"]:
    graph.add_edge(node, "format_tts")
graph.add_edge("format_tts", END)

agent = graph.compile()
