/**
 * AI — настройки ИИ внутри комнаты (перенос из модалки AiSettingsModal).
 *
 * Модалка удалена: единственный вход был из меню аватара. Здесь та же форма,
 * но инлайн. Источник правды — ai-settings.store; запись идёт на каждое
 * изменение (как было в модалке), отдельной кнопки Save больше нет.
 *
 * Auth не трогаем: гостю показываем тот же вход, что уже есть в карточке
 * профиля — через authService.initiateGoogleOAuth(), без прямых URL.
 */

import { useCallback, useState } from 'react';
import {
  useAiSettingsStore,
  AI_MODELS,
} from '../../../../stores/ai-settings.store';
import { aiHub } from '../../../../js/ai/registry';
import { useUserProfileStore } from '../../../../stores/user-profile.store';
import { authService } from '../../../../services/auth.service';

type TestResult = 'ok' | 'fail' | null;

export function AiSection() {
  const isGuest = useUserProfileStore(s => s.isGuest);

  const openRouterApiKey = useAiSettingsStore(s => s.openRouterApiKey);
  const modelId = useAiSettingsStore(s => s.modelId);
  const coachName = useAiSettingsStore(s => s.coachName);
  const temperature = useAiSettingsStore(s => s.temperature);
  const setOpenRouterApiKey = useAiSettingsStore(s => s.setOpenRouterApiKey);
  const setModelId = useAiSettingsStore(s => s.setModelId);
  const setCoachName = useAiSettingsStore(s => s.setCoachName);
  const setTemperature = useAiSettingsStore(s => s.setTemperature);
  const setProvider = useAiSettingsStore(s => s.setProvider);
  const markVerified = useAiSettingsStore(s => s.markVerified);

  const [keyInput, setKeyInput] = useState(openRouterApiKey);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleKeyChange = useCallback(
    (value: string) => {
      setKeyInput(value);
      setProvider(value.trim() ? 'openrouter-direct' : 'belive');
    },
    [setProvider],
  );

  const handleModelChange = useCallback(
    (id: string) => {
      setModelId(id);
      aiHub.setActiveModel(id);
    },
    [setModelId],
  );

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    setOpenRouterApiKey(keyInput);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${keyInput}` },
        signal: AbortSignal.timeout(8000),
      });
      setTestResult(res.ok ? 'ok' : 'fail');
      if (res.ok) {markVerified();}
    } catch {
      setTestResult('fail');
    } finally {
      setTesting(false);
    }
  }, [keyInput, setOpenRouterApiKey, markVerified]);

  if (isGuest) {
    return (
      <section className="bl-settings__panel" aria-labelledby="bl-ai-title">
        <div className="bl-settings__panel-head">
          <h3 className="bl-settings__panel-title" id="bl-ai-title">
            ИИ
          </h3>
          <span className="bl-settings__badge">гость</span>
        </div>
        <p className="bl-settings__note">
          Билли — твой вокальный коуч. Войди через Google, чтобы получить умного
          помощника и свой ключ.
        </p>
        <button
          type="button"
          className="bl-settings__cta"
          onClick={() => void authService.initiateGoogleOAuth()}
        >
          Войти через Google
        </button>
      </section>
    );
  }

  const hasKey = keyInput.trim().length > 0;

  return (
    <section className="bl-settings__panel" aria-labelledby="bl-ai-title">
      <div className="bl-settings__panel-head">
        <h3 className="bl-settings__panel-title" id="bl-ai-title">
          ИИ
        </h3>
        <span className="bl-settings__badge is-ok">Билли активен</span>
      </div>

      <label className="bl-settings__field">
        <span className="bl-settings__label">Имя коуча</span>
        <input
          className="bl-settings__input"
          type="text"
          value={coachName}
          onChange={e => setCoachName(e.target.value)}
          placeholder="Билли"
        />
      </label>

      <button
        type="button"
        className="bl-settings__disclosure"
        aria-expanded={showAdvanced}
        onClick={() => setShowAdvanced(v => !v)}
      >
        <span className={'bl-settings__caret' + (showAdvanced ? ' is-open' : '')} aria-hidden="true">
          ▸
        </span>
        Настроить свой AI
      </button>

      {showAdvanced && (
        <div className="bl-settings__advanced">
          <label className="bl-settings__field">
            <span className="bl-settings__label">OpenRouter API key</span>
            <span className="bl-settings__keyrow">
              <input
                className="bl-settings__input"
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={e => handleKeyChange(e.target.value)}
                placeholder="sk-or-v1-..."
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="bl-settings__icon-btn"
                aria-label={showKey ? 'Скрыть ключ' : 'Показать ключ'}
                aria-pressed={showKey}
                onClick={() => setShowKey(v => !v)}
              >
                {showKey ? '🙈' : '👁️'}
              </button>
            </span>
            <span className="bl-settings__row-hint">
              Свой ключ — без лимита beLive.{' '}
              <a
                className="bl-settings__link"
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
              >
                Получить ключ →
              </a>
            </span>
          </label>

          <label className="bl-settings__field">
            <span className="bl-settings__label">Модель</span>
            <select
              className="bl-settings__input"
              value={modelId}
              onChange={e => handleModelChange(e.target.value)}
              disabled={!hasKey}
            >
              {!hasKey && <option value="">Сначала ключ</option>}
              {AI_MODELS.openrouter.map(m => (
                <option key={m.id} value={m.id}>
                  {m.shortName} ({m.costTier === 'free' ? 'Free' : 'Paid'}) —{' '}
                  {(m.ctx / 1000).toFixed(0)}K ctx
                </option>
              ))}
            </select>
          </label>

          <label className="bl-settings__field">
            <span className="bl-settings__label">
              Температура <span className="bl-settings__row-hint">{temperature.toFixed(1)}</span>
            </span>
            <input
              className="bl-settings__range"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={e => setTemperature(parseFloat(e.target.value))}
              aria-label="Температура"
            />
            <span className="bl-settings__range-ends" aria-hidden="true">
              <span>Точно</span>
              <span>Творчески</span>
            </span>
          </label>

          <div className="bl-settings__actions">
            <button
              type="button"
              className="bl-settings__cta is-ghost"
              onClick={() => void handleTest()}
              disabled={!hasKey || testing}
            >
              {testing ? 'Проверяю…' : 'Проверить ключ'}
            </button>
            {testResult === 'ok' && (
              <span className="bl-settings__status is-ok" role="status">
                ● Ключ работает
              </span>
            )}
            {testResult === 'fail' && (
              <span className="bl-settings__status is-fail" role="status">
                ● Ключ не принят
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
