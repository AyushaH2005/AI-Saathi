import { create } from 'zustand';

interface Guardrail {
  action: string;
  field?: string;
  field_type?: string;
  label?: string;
  message?: string;
  question?: string;
  severity?: string;
}

interface AgentAction {
  action: string;
  selector?: string;
  value?: string;
  url?: string;
  field_type?: string;
  message?: string;
  severity?: string;
}

interface AppState {
  // Page state
  pageTitle: string;
  pageUrl: string;
  pageText: string;

  // Agent state
  mode: 'explain' | 'simplify' | 'scam_check' | 'guide';
  language: 'en' | 'hi' | 'ta' | 'bn' | 'mr';
  question: string;
  response: string;
  loading: boolean;
  streaming: boolean;
  error: string | null;
  showResponse: boolean;

  // Server config
  serverUrl: string;
  agentUrl: string;

  // Voice state
  isListening: boolean;
  transcript: string;

  // Agent results
  pendingGuardrails: Guardrail[];
  agentActions: AgentAction[];
  detectedIntent: string;
  detectedLanguage: string;
  ttsText: string;

  // Conversation
  conversationHistory: { role: string; text: string }[];

  // Actions
  setPageContent: (title: string, url: string, text: string) => void;
  setMode: (mode: AppState['mode']) => void;
  setLanguage: (lang: AppState['language']) => void;
  setQuestion: (q: string) => void;
  setResponse: (r: string) => void;
  appendResponse: (token: string) => void;
  setLoading: (l: boolean) => void;
  setStreaming: (s: boolean) => void;
  setError: (e: string | null) => void;
  setServerUrl: (u: string) => void;
  setAgentUrl: (u: string) => void;
  setShowResponse: (s: boolean) => void;
  setListening: (l: boolean) => void;
  setTranscript: (t: string) => void;
  setPendingGuardrails: (g: Guardrail[]) => void;
  setAgentActions: (a: AgentAction[]) => void;
  setDetectedIntent: (i: string) => void;
  setDetectedLanguage: (l: string) => void;
  setTtsText: (t: string) => void;
  addConversationEntry: (role: string, text: string) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  pageTitle: '',
  pageUrl: '',
  pageText: '',
  mode: 'explain',
  language: 'hi',
  question: '',
  response: '',
  loading: false,
  streaming: false,
  error: null,
  showResponse: false,
  serverUrl: 'http://192.168.1.5:3001',
  agentUrl: 'http://192.168.1.5:8000',
  isListening: false,
  transcript: '',
  pendingGuardrails: [],
  agentActions: [],
  detectedIntent: 'general',
  detectedLanguage: 'hi',
  ttsText: '',
  conversationHistory: [],

  setPageContent: (title, url, text) => set({ pageTitle: title, pageUrl: url, pageText: text }),
  setMode: (mode) => set({ mode }),
  setLanguage: (language) => set({ language }),
  setQuestion: (question) => set({ question }),
  setResponse: (response) => set({ response }),
  appendResponse: (token) => set((s) => ({ response: s.response + token })),
  setLoading: (loading) => set({ loading }),
  setStreaming: (streaming) => set({ streaming }),
  setError: (error) => set({ error }),
  setServerUrl: (serverUrl) => set({ serverUrl }),
  setAgentUrl: (agentUrl) => set({ agentUrl }),
  setShowResponse: (showResponse) => set({ showResponse }),
  setListening: (isListening) => set({ isListening }),
  setTranscript: (transcript) => set({ transcript }),
  setPendingGuardrails: (pendingGuardrails) => set({ pendingGuardrails }),
  setAgentActions: (agentActions) => set({ agentActions }),
  setDetectedIntent: (detectedIntent) => set({ detectedIntent }),
  setDetectedLanguage: (detectedLanguage) => set({ detectedLanguage }),
  setTtsText: (ttsText) => set({ ttsText }),
  addConversationEntry: (role, text) => set((s) => ({
    conversationHistory: [...s.conversationHistory, { role, text }].slice(-10),
  })),
  reset: () => set({ response: '', question: '', loading: false, streaming: false, error: null, pendingGuardrails: [], agentActions: [] }),
}));
