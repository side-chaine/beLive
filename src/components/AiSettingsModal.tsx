import { useState, useEffect, useCallback } from 'react';
import { useAiSettingsStore } from '../stores/ai-settings.store';
import { aiHub } from '../js/ai/registry';
import { useUserProfileStore } from '../stores/user-profile.store';
import { AI_MODELS } from '../stores/ai-settings.store';
import styles from './AiSettingsModal.module.css';

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
  const setProvider = useAiSettingsStore(s => s.setProvider);

  const isGuest = useUserProfileStore(s => s.isGuest);

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

      } else {

      }
    } catch (err) {
      setTestResult('fail');

    }
    setTesting(false);
  }, [keyInput, setOpenRouterApiKey, markVerified]);

  const handleModelChange = useCallback((id: string) => {
    setModelId(id);
    aiHub.setActiveModel(id);

  }, [setModelId]);

  const handleSave = useCallback(() => {
    if (keyInput.trim()) {
      setOpenRouterApiKey(keyInput);
      setProvider('openrouter-direct');
    } else {
      setProvider('belive');
    }
    if (modelId) {
      aiHub.setActiveModel(modelId);
    }
    useAiSettingsStore.getState().setShowSettings(false);
    onClose();
  }, [keyInput, modelId, onClose, setOpenRouterApiKey, setModelId]);

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
          {/* Guest block */}
          {isGuest && (
            <div className={styles.section}>
              <div style={{ fontSize: 24, marginBottom: 8, textAlign: 'center' }}>⭐</div>
              <div style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 12 }}>
                Billy — твой вокальный коуч<br />
                Войди через Google, чтобы получить умного помощника.
              </div>
              <button
                type="button"
                onClick={() => {
                  window.location.href = `${import.meta.env.VITE_AUTH_WORKER_URL || '/auth/google'}/auth/google`;
                }}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff', fontSize: 13, fontFamily: 'inherit',
                }}
              >
                Войти через Google
              </button>
            </div>
          )}

          {/* Billy active — only for logged in */}
          {!isGuest && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>BILLY STATUS</div>
              <div style={{ fontSize: 13, color: 'rgba(34,197,94,0.8)', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✅</span> Билли активен
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginLeft: 'auto' }}>Built-in AI · 20/день</span>
              </div>
            </div>
          )}

          {/* Coach Name — always visible */}
          {!isGuest && (
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
          )}

          {/* Advanced section — только для залогиненных */}
          {!isGuest && (
            <>
              <div className={styles.advancedToggle} onClick={() => setShowAdvanced(!showAdvanced)}>
                <svg className={`${styles.advancedArrow} ${showAdvanced ? styles.advancedArrowOpen : ''}`} width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>НАСТРОИТЬ СВОЙ AI</span>
              </div>

              {showAdvanced && (
                <div className={styles.advancedContent}>
                  {/* API Key */}
                  <div className={styles.section}>
                    <div className={styles.sectionTitle}>OPENROUTER API KEY</div>
                    <div className={styles.keyRow}>
                      <input
                        className={styles.keyInput}
                        type={showKey ? 'text' : 'password'}
                        value={keyInput}
                        onChange={e => {
                          setKeyInput(e.target.value);
                          if (e.target.value.trim()) {
                            setProvider('openrouter-direct');
                          } else {
                            setProvider('belive');
                          }
                        }}
                        placeholder="sk-or-v1-..."
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

                  {/* Model select — OpenRouter models */}
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
                          if (keyInput.trim()) {
                            setProvider('openrouter-direct');
                          }
                        }
                      }}
                      disabled={!keyInput.trim()}
                    >
                      {!keyInput.trim() && (<option value="">Enter API key first</option>)}
                      {keyInput.trim() && !modelId && !customModelMode && (<option value="">Select model...</option>)}
                      {AI_MODELS.openrouter.map(m => (
                        <option key={m.id} value={m.id}>{m.shortName} ({m.costTier === 'free' ? 'Free' : 'Paid'}) — {(m.ctx / 1000).toFixed(0)}K ctx</option>
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
                  </div>

                  {/* Temperature */}
                  <div className={styles.section}>
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
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {!isGuest && keyInput.trim() && (
            <button className={styles.testBtn} onClick={handleTest} disabled={testing} type="button">
              {testing ? 'Checking...' : 'Test Connection'}
            </button>
          )}
          {!isGuest && !keyInput.trim() && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginRight: 'auto' }}>
              ✓ Always available
            </span>
          )}
          <button className={styles.saveBtn} onClick={handleSave} type="button">Save</button>
        </div>
      </div>
    </div>
  );
}
