import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Modal, Animated, Alert,
} from 'react-native';
import { useState, useRef, useCallback, useEffect } from 'react';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useAppStore } from '../store/appStore';
import { startAnalysis, confirmGuardrail } from '../hooks/useAnalysis';
import {
  EXTRACT_CONTENT, INJECT_FAB, INJECT_SCAM_SCAN,
  INJECT_GUIDE, INJECT_CLEANUP, INJECT_GET_FORM_FIELDS,
  INJECT_FORM_FILL, INJECT_CLICK, INJECT_WARNING,
} from '../utils/injectScripts';
import { Colors } from '../constants/theme';

const MODES = [
  { id: 'explain', icon: 'bulb-outline', hi: 'समझाओ', color: '#2563eb' },
  { id: 'simplify', icon: 'pencil-outline', hi: 'आसान करो', color: '#8b5cf6' },
  { id: 'scam_check', icon: 'shield-checkmark-outline', hi: 'सुरक्षित?', color: '#dc2626' },
  { id: 'guide', icon: 'navigate-outline', hi: 'गाइड', color: '#16a34a' },
] as const;

const LANG_CODES: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', bn: 'bn-IN', mr: 'mr-IN' };

export default function HomeScreen() {
  const webViewRef = useRef<WebView>(null);
  const [url, setUrl] = useState('https://www.google.com');
  const [inputUrl, setInputUrl] = useState('https://www.google.com');
  const [webLoading, setWebLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  // Mic pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const mode = useAppStore(s => s.mode);
  const language = useAppStore(s => s.language);
  const question = useAppStore(s => s.question);
  const response = useAppStore(s => s.response);
  const loading = useAppStore(s => s.loading);
  const error = useAppStore(s => s.error);
  const showResponse = useAppStore(s => s.showResponse);
  const serverUrl = useAppStore(s => s.serverUrl);
  const agentUrl = useAppStore(s => s.agentUrl);
  const pageTitle = useAppStore(s => s.pageTitle);
  const pendingGuardrails = useAppStore(s => s.pendingGuardrails);
  const agentActions = useAppStore(s => s.agentActions);
  const detectedLanguage = useAppStore(s => s.detectedLanguage);
  const ttsText = useAppStore(s => s.ttsText);
  const isListening = useAppStore(s => s.isListening);

  const setMode = useAppStore(s => s.setMode);
  const setQuestion = useAppStore(s => s.setQuestion);
  const setPageContent = useAppStore(s => s.setPageContent);
  const setShowResponse = useAppStore(s => s.setShowResponse);
  const setServerUrl = useAppStore(s => s.setServerUrl);
  const setAgentUrl = useAppStore(s => s.setAgentUrl);
  const setListening = useAppStore(s => s.setListening);
  const setTranscript = useAppStore(s => s.setTranscript);
  const reset = useAppStore(s => s.reset);

  // Execute agent actions via WebView injection
  useEffect(() => {
    if (!agentActions.length) return;
    agentActions.forEach(action => {
      if (action.action === 'fill_field' && action.selector && action.value) {
        webViewRef.current?.injectJavaScript(INJECT_FORM_FILL(action.selector, action.value));
      } else if (action.action === 'click' && action.selector) {
        webViewRef.current?.injectJavaScript(INJECT_CLICK(action.selector));
      } else if (action.action === 'navigate' && action.url) {
        setUrl(action.url);
        setInputUrl(action.url);
      } else if (action.action === 'show_warning' && action.message) {
        webViewRef.current?.injectJavaScript(INJECT_WARNING(action.message, action.severity || 'warning'));
      } else if (action.action === 'get_form_fields') {
        webViewRef.current?.injectJavaScript(INJECT_GET_FORM_FIELDS);
      }
    });
    useAppStore.getState().setAgentActions([]);
  }, [agentActions]);

  // Auto-speak when response arrives
  useEffect(() => {
    if (ttsText && !loading && showResponse) {
      const clean = ttsText.replace(/\[\d+\]/g, '').replace(/\*+/g, '').trim();
      if (clean) {
        Speech.speak(clean, {
          language: LANG_CODES[detectedLanguage] || LANG_CODES[language] || 'hi-IN',
          rate: 0.9,
          onDone: () => setSpeaking(false),
        });
        setSpeaking(true);
      }
    }
  }, [ttsText, loading]);

  // Mic pulse animation
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  const handleLoadEnd = useCallback(() => {
    setWebLoading(false);
    webViewRef.current?.injectJavaScript(EXTRACT_CONTENT);
    webViewRef.current?.injectJavaScript(INJECT_FAB);
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'page_content') setPageContent(data.title, data.url, data.text);
      else if (data.type === 'fab_pressed') setShowResponse(true);
      else if (data.type === 'form_fields') {
        // Form fields returned from page — handle if needed
      }
    } catch {}
  }, []);

  // Poll page content
  useEffect(() => {
    const iv = setInterval(() => {
      webViewRef.current?.injectJavaScript(EXTRACT_CONTENT);
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  function handleAnalyze() {
    if (mode === 'scam_check') webViewRef.current?.injectJavaScript(INJECT_SCAM_SCAN);
    else if (mode === 'guide') webViewRef.current?.injectJavaScript(INJECT_GUIDE);
    startAnalysis();
  }

  function handleVoicePress() {
    // Since expo-speech-recognition may not be available, we toggle to text input mode
    // and let the user type their question, then auto-analyze
    if (isListening) {
      setListening(false);
      if (useAppStore.getState().transcript) {
        setQuestion(useAppStore.getState().transcript);
        startAnalysis(useAppStore.getState().transcript);
      }
    } else {
      setListening(true);
      setTranscript('');
      // For now, focus the text input as voice proxy
      // In production, this would use expo-speech-recognition
    }
  }

  function handleSubmitUrl() {
    let u = inputUrl.trim();
    if (!u) return;
    if (!u.startsWith('http')) u = 'https://' + u;
    setUrl(u); setInputUrl(u);
  }

  function toggleSpeak() {
    if (speaking) { Speech.stop(); setSpeaking(false); return; }
    if (!response) return;
    const clean = response.replace(/\[\d+\]/g, '').replace(/\*+/g, '').trim();
    Speech.speak(clean, {
      language: LANG_CODES[detectedLanguage] || LANG_CODES[language] || 'hi-IN',
      rate: 0.9, onDone: () => setSpeaking(false),
    });
    setSpeaking(true);
  }

  function closeResponse() {
    Speech.stop();
    setSpeaking(false);
    setShowResponse(false); reset();
    webViewRef.current?.injectJavaScript(INJECT_CLEANUP);
  }

  function handleGuardrailResponse(guardrail: any, approved: boolean) {
    confirmGuardrail(guardrail, approved);
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* URL Bar */}
      <View style={s.urlBar}>
        <TouchableOpacity onPress={() => webViewRef.current?.goBack()} disabled={!canGoBack} style={s.navBtn}>
          <Ionicons name="chevron-back" size={20} color={canGoBack ? '#333' : '#ccc'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => webViewRef.current?.goForward()} disabled={!canGoForward} style={s.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={canGoForward ? '#333' : '#ccc'} />
        </TouchableOpacity>
        <TextInput style={s.urlInput} value={inputUrl} onChangeText={setInputUrl}
          onSubmitEditing={handleSubmitUrl} returnKeyType="go" autoCapitalize="none"
          autoCorrect={false} keyboardType="url" placeholder="Search or enter URL"
          placeholderTextColor="#999" selectTextOnFocus />
        <TouchableOpacity onPress={() => webViewRef.current?.reload()} style={s.navBtn}>
          <Ionicons name="refresh" size={18} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Browser */}
      <View style={s.browser}>
        <WebView ref={webViewRef} source={{ uri: url }} style={s.webview}
          onNavigationStateChange={e => { setInputUrl(e.url); setCanGoBack(e.canGoBack); setCanGoForward(e.canGoForward); }}
          onLoadStart={() => setWebLoading(true)} onLoadEnd={handleLoadEnd}
          onMessage={handleMessage} javaScriptEnabled domStorageEnabled
          allowsBackForwardNavigationGestures startInLoadingState />
        {webLoading && <View style={s.loadBar}><View style={s.loadProgress} /></View>}
      </View>

      {/* Response Panel */}
      {showResponse && (
        <View style={s.respPanel}>
          <View style={s.respHead}>
            <Text style={s.respTitle} numberOfLines={1}>{loading ? 'AI Saathi सोच रहा है...' : pageTitle || 'Response'}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {!loading && response && (
                <TouchableOpacity style={[s.ttsSmallBtn, { backgroundColor: speaking ? Colors.danger : Colors.success }]} onPress={toggleSpeak}>
                  <Ionicons name={speaking ? 'stop' : 'volume-high'} size={16} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={closeResponse}><Ionicons name="close" size={22} color="#666" /></TouchableOpacity>
            </View>
          </View>
          <ScrollView style={s.respBody}>
            {loading && !response && <View style={s.skelWrap}>
              <View style={[s.skelLine, { width: '90%' }]} />
              <View style={[s.skelLine, { width: '100%' }]} />
              <View style={[s.skelLine, { width: '70%' }]} />
            </View>}
            {error && <Text style={s.errText}>⚠️ {error}</Text>}
            <Text style={s.respText}>{response}</Text>
          </ScrollView>

          {/* Guardrail Confirmations */}
          {pendingGuardrails.length > 0 && (
            <View style={s.guardrailSection}>
              {pendingGuardrails.map((g, i) => (
                <View key={i} style={[s.guardrailCard, g.severity === 'high' && s.guardrailCardHigh]}>
                  <Text style={s.guardrailMsg}>{g.message || g.question}</Text>
                  {g.action === 'guardrail_block' ? (
                    <Text style={s.guardrailNote}>कृपया खुद भरें / Please fill manually</Text>
                  ) : (
                    <View style={s.guardrailBtns}>
                      <TouchableOpacity style={[s.grBtn, s.grBtnYes]} onPress={() => handleGuardrailResponse(g, true)}>
                        <Text style={s.grBtnText}>हां / Yes</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.grBtn, s.grBtnNo]} onPress={() => handleGuardrailResponse(g, false)}>
                        <Text style={s.grBtnText}>नहीं / No</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Bottom Controls */}
      <View style={s.controls}>
        {showSettings && <View style={s.settSection}>
          <TextInput style={s.settInput} value={agentUrl} onChangeText={setAgentUrl}
            placeholder="Agent URL (e.g. http://192.168.1.5:8000)" placeholderTextColor="#999"
            autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <TextInput style={s.settInput} value={serverUrl} onChangeText={setServerUrl}
            placeholder="Server URL (fallback)" placeholderTextColor="#999"
            autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        </View>}

        {/* Mode Buttons */}
        <View style={s.modes}>
          {MODES.map(m => (
            <TouchableOpacity key={m.id}
              style={[s.modeBtn, mode === m.id && { borderColor: m.color, backgroundColor: m.color + '14' }]}
              onPress={() => setMode(m.id)}>
              <Ionicons name={m.icon as any} size={18} color={mode === m.id ? m.color : '#64748b'} />
              <Text style={[s.modeLbl, mode === m.id && { color: m.color }]}>{m.hi}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Input Row */}
        <View style={s.qRow}>
          <TouchableOpacity onPress={() => setShowSettings(!showSettings)} style={s.iconBtn}>
            <Ionicons name="settings-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          <TextInput style={s.qInput} value={question} onChangeText={setQuestion}
            placeholder={isListening ? 'सुन रहा हूं... / Listening...' : 'बोलो या लिखो... / Speak or type...'}
            placeholderTextColor={isListening ? Colors.primary : '#94a3b8'}
            returnKeyType="send" onSubmitEditing={handleAnalyze}
            autoFocus={isListening} />

          {/* Voice / Mic Button */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity style={[s.micBtn, isListening && s.micBtnActive]} onPress={handleVoicePress}>
              <Ionicons name={isListening ? 'radio' : 'mic'} size={22} color="#fff" />
            </TouchableOpacity>
          </Animated.View>

          {/* Send Button */}
          <TouchableOpacity style={s.goBtn} onPress={handleAnalyze}>
            <Ionicons name="send" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  urlBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 4, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border, paddingTop: 48 },
  navBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  urlInput: { flex: 1, height: 36, borderRadius: 10, backgroundColor: '#f1f5f9', paddingHorizontal: 12, fontSize: 14, color: Colors.text },
  browser: { flex: 1, position: 'relative' },
  webview: { flex: 1, backgroundColor: '#fff' },
  loadBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#e2e8f0' },
  loadProgress: { height: 3, width: '60%', backgroundColor: Colors.primary },
  respPanel: { maxHeight: 320, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colors.border },
  respHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  respTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1 },
  respBody: { padding: 16, maxHeight: 180 },
  skelWrap: { gap: 10 },
  skelLine: { height: 16, borderRadius: 6, backgroundColor: '#e2e8f0' },
  respText: { fontSize: 16, lineHeight: 24, color: Colors.text },
  errText: { fontSize: 14, color: Colors.danger, marginBottom: 6 },
  ttsSmallBtn: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  // Guardrails
  guardrailSection: { paddingHorizontal: 12, paddingBottom: 8, gap: 6 },
  guardrailCard: { backgroundColor: '#fef3c7', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#f59e0b' },
  guardrailCardHigh: { backgroundColor: '#fee2e2', borderColor: '#dc2626' },
  guardrailMsg: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  guardrailNote: { fontSize: 12, color: '#64748b', fontStyle: 'italic' },
  guardrailBtns: { flexDirection: 'row', gap: 8 },
  grBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  grBtnYes: { backgroundColor: '#16a34a' },
  grBtnNo: { backgroundColor: '#64748b' },
  grBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  // Controls
  controls: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 20, gap: 6 },
  settSection: { gap: 4, paddingHorizontal: 4 },
  settInput: { height: 36, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 10, fontSize: 13, color: Colors.text, backgroundColor: '#f8fafc' },
  modes: { flexDirection: 'row', gap: 4 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#fff' },
  modeLbl: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  qInput: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 12, fontSize: 15, color: Colors.text },
  micBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  micBtnActive: { backgroundColor: '#dc2626', shadowColor: '#dc2626', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 12, elevation: 8 },
  goBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
});
