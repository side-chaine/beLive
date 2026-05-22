import { useState, useEffect, useCallback } from 'react';
import { useAiSettingsStore } from '../stores/ai-settings.store';
import { aiHub } from '../js/ai/registry';
import styles from './AiSettingsModal.module.css';

const PROVIDER_MODELS = [
  { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek V3', cost: 'free', ctx: '64K' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', cost: 'free', ctx: '64K' },
  { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', cost: 'free', ctx: '1M' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', cost: 'low', ctx: '1M' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', cost: 'low', ctx: '128K' },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', cost: 'low', ctx: '200K' },
];

const COST_LABELS: Record<string, string> = { free: 'Free', low: 'Paid' };

export function AiSettingsModal({ onClose }: { onClose: () => void }) {
  const openRouterApiKey = useAiSettingsStore(s => s.openRouterApiKey);
  const modelId = useAiSettingsStore(s => s.modelId);
  const coachName = useAiSettingsStore(s => s.coachName);
  const temperature = useAiSettingsStore(s => s.temperature);
  const setOpenRouterApiKey = useAiSettingsStore(s => s.setOpenRouterApiKey);
  const setModelId = useAiSettingsStore(s => s.setModelId);
  const setCoachName = useAiSettingsStore(s => s.setCoachName);
  const setTemperature = useAiSettingsStore(s => s.setTemperature);
  const markVerified = useAiSettingsStore(s => s.markVerified);

  const [keyInput, setKeyInput] = useState(openRouterApiKey);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customModelMode, setCustomModelMode] = useState(false);
  const [customModelId, setCustomModelId] = useState('');

  // ESC handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        useAiSettingsStore.getState().setShowSettings(false);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    setOpenRouterApiKey(keyInput);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${keyInput}` },
        signal: AbortSignal.timeout(8000),
      });
      const ok = res.ok;
      setTestResult(ok ? 'ok' : 'fail');
      if (ok) {
        markVerified();
        console.log('[AI] Connection test: OK');
      } else {
        console.log('[AI] Connection test: FAIL — status:', res.status);
      }
    } catch (err) {
      setTestResult('fail');
      console.log('[AI] Connection test: FAIL —', err);
    }
    setTesting(false);
  }, [keyInput, setOpenRouterApiKey, markVerified]);

  const handleModelChange = useCallback((id: string) => {
    setModelId(id);
    aiHub.setActiveModel(id);
    console.log('[AI] Model selected:', id);
  }, [setModelId]);

  const handleSave = useCallback(() => {
    setOpenRouterApiKey(keyInput);
    if (modelId) {
      aiHub.setActiveModel(modelId);
    } else if (keyInput) {
      const defaultModel = 'deepseek/deepseek-chat-v3-0324';
      setModelId(defaultModel);
      aiHub.setActiveModel(defaultModel);
    }
    console.log('[AI] Settings saved. Model:', aiHub.getActiveModel()?.shortName || 'none');
    useAiSettingsStore.getState().setShowSettings(false);
    onClose();
  }, [keyInput, modelId, onClose, setOpenRouterApiKey, setModelId]);

  const selectedModel = PROVIDER_MODELS.find(m => m.id === modelId);
  const isConfigured = !!keyInput.trim();

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <svg className={styles.headerIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L10 5.5L14 6L11 9.5L12 14L8 11.5L4 14L5 9.5L2 6L6 5.5L8 1Z" fill="currentColor" opacity="0.6" />
            </svg>
            <span className={styles.headerTitle}>AI Configuration</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* API Provider */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>API PROVIDER</div>
            <div className={styles.selectRow}>
              <span className={styles.providerBadge}>OR</span>
              <span className={styles.providerName}>OpenRouter</span>
              <span className={styles.providerTag}>Local API Key</span>
            </div>
          </div>

          {/* API Key */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>OPENROUTER API KEY</div>
            <div className={styles.keyRow}>
              <input
                className={styles.keyInput}
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                placeholder="sk-or-v1-..."
                autoFocus
              />
              <button
                className={styles.keyToggle}
                onClick={() => setShowKey(!showKey)}
                title={showKey ? 'Hide' : 'Show'}
                type="button"
              >
                {showKey ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 7C1 7 3 2 7 2C11 2 13 7 13 7C13 7 11 12 7 12C3 12 1 7 1 7Z" stroke="currentColor" strokeWidth="1.2" />
                    <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 2L12 12M5 5.5C5 4.1 6.1 3 7.5 3C8.9 3 10 4.1 10 5.5M3 7C3 7 4 4.5 7 4.5C10 4.5 11 7 11 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    <path d="M1 7C1 7 3 12 7 12C11 12 13 7 13 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>
            <div className={styles.sectionFooter}>
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className={styles.link}>Get API key →</a>
              {testResult === 'ok' && <span className={styles.statusOk}>● Verified</span>}
              {testResult === 'fail' && <span className={styles.statusFail}>● Invalid key</span>}
            </div>
          </div>

          {/* Model */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>MODEL</div>
            <select
              className={styles.modelSelect}
              value={customModelMode ? '__custom__' : modelId}
              onChange={e => {
                if (e.target.value === '__custom__') {
                  setCustomModelMode(true);
                } else {
                  setCustomModelMode(false);
                  setCustomModelId('');
                  handleModelChange(e.target.value);
                }
              }}
              disabled={!isConfigured}
            >
              {!isConfigured && (<option value="">Enter API key first</option>)}
              {isConfigured && !modelId && !customModelMode && (<option value="">Select model...</option>)}
              {PROVIDER_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({COST_LABELS[m.cost] || m.cost}) — {m.ctx} ctx</option>
              ))}
              <option value="__custom__">Custom model...</option>
            </select>
            {customModelMode && (
              <div className={styles.customModelSection}>
                <input
                  className={styles.textInput}
                  type="text"
                  value={customModelId}
                  onChange={e => setCustomModelId(e.target.value)}
                  placeholder="e.g. openai/gpt-4o"
                  autoFocus
                />
                <button
                  className={styles.customModelApply}
                  onClick={() => {
                    if (customModelId.trim()) {
                      handleModelChange(customModelId.trim());
                    }
                  }}
                  disabled={!customModelId.trim()}
                  type="button"
                >
                  Apply
                </button>
              </div>
            )}
            {!customModelMode && selectedModel && (
              <div className={styles.modelMeta}>
                <span className={`${styles.modelCostBadge} ${selectedModel.cost === 'free' ? styles.modelCostFree : styles.modelCostPaid}`}>{selectedModel.cost === 'free' ? 'Free' : 'Paid'}</span>
                <span className={styles.modelCtxInfo}>{selectedModel.ctx} context</span>
              </div>
            )}
          </div>

          {/* Coach Name */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>COACH NAME</div>
            <input
              className={styles.textInput}
              type="text"
              value={coachName}
              onChange={e => setCoachName(e.target.value)}
              placeholder="Билли"
            />
          </div>

          {/* Advanced (collapsible) */}
          <div className={styles.advancedToggle} onClick={() => setShowAdvanced(!showAdvanced)}>
            <svg className={`${styles.advancedArrow} ${showAdvanced ? styles.advancedArrowOpen : ''}`} width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>ADVANCED</span>
          </div>

          {showAdvanced && (
            <div className={styles.advancedContent}>
              <div className={styles.sectionTitle}>TEMPERATURE</div>
              <div className={styles.tempRow}>
                <input
                  className={styles.tempRange}
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                />
                <span className={styles.tempValue}>{temperature.toFixed(1)}</span>
              </div>
              <div className={styles.tempLabels}>
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.testBtn} onClick={handleTest} disabled={testing || !keyInput.trim()} type="button">
            {testing ? 'Checking...' : 'Test Connection'}
          </button>
          <button className={styles.saveBtn} onClick={handleSave} type="button">Save</button>
        </div>
      </div>
    </div>
  );
}
