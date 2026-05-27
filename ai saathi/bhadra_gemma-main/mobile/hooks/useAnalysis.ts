import { useAppStore } from '../store/appStore';

export async function startAnalysis(userInput?: string) {
  const s = useAppStore.getState();
  const input = userInput || s.question;

  if (!input?.trim()) {
    s.setError('Please speak or type a question first.');
    return;
  }

  s.reset();
  s.setLoading(true);
  s.setShowResponse(true);
  s.addConversationEntry('user', input);

  try {
    const res = await fetch(`${s.agentUrl}/api/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_input: input,
        page_text: `Page: ${s.pageTitle}\nURL: ${s.pageUrl}\n\n${s.pageText}`,
        page_url: s.pageUrl,
        page_title: s.pageTitle,
        conversation_history: s.conversationHistory,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Agent error ${res.status}`);
    }

    const data = await res.json();

    s.setLoading(false);
    s.setResponse(data.response_text || 'No response');
    s.setDetectedIntent(data.intent || 'general');
    s.setDetectedLanguage(data.language || 'hi');
    s.setTtsText(data.tts_text || data.response_text || '');

    if (data.guardrails?.length) {
      s.setPendingGuardrails(data.guardrails);
    }

    if (data.actions?.length) {
      s.setAgentActions(data.actions);
    }

    s.addConversationEntry('assistant', data.response_text || '');
  } catch (err: any) {
    // Fallback to Express server if agent is down
    try {
      const fallbackRes = await fetch(`${s.serverUrl}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshot: undefined,
          pageText: `Page: ${s.pageTitle}\nURL: ${s.pageUrl}\n\n${s.pageText}`,
          mode: s.mode,
          language: s.language,
          question: input,
        }),
      });

      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        s.setLoading(false);
        s.setResponse(fallbackData.text || 'No response');
        s.setTtsText(fallbackData.text || '');
        s.addConversationEntry('assistant', fallbackData.text || '');
        return;
      }
    } catch {}

    s.setError(err.message || 'Analysis failed');
    s.setLoading(false);
  }
}

export async function confirmGuardrail(guardrail: any, approved: boolean) {
  const s = useAppStore.getState();

  if (!approved) {
    s.setPendingGuardrails(s.pendingGuardrails.filter(g => g !== guardrail));
    return;
  }

  try {
    const res = await fetch(`${s.agentUrl}/api/execute-confirmed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: guardrail }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.action) {
        s.setAgentActions([...s.agentActions, data.action]);
      }
    }
  } catch {}

  s.setPendingGuardrails(s.pendingGuardrails.filter(g => g !== guardrail));
}
