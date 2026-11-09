/**
 * Настройки комнаты — каркас.
 *
 * Сюда переехало то, что раньше жило в меню аватара и в модалке AI Configuration:
 * настройки ИИ и качество графики. Меню теперь только вход + быстрые тумблеры.
 *
 * Секции самостоятельны и пишут в свои сторы — блок ничего не хранит.
 */

import { AiSection } from './AiSection';
import { GraphicsSection } from './GraphicsSection';
import { HintToggle } from '../../../../hints/HintToggle';
import './settings.css';

export function SettingsBlock() {
  return (
    <section className="bl-settings" aria-labelledby="bl-settings-title">
      <h2 className="bl-settings__title" id="bl-settings-title">
        Настройки
      </h2>

      {/* Подсказки — тот же тумблер, что в меню; здесь он в контексте настроек. */}
      <div className="bl-settings__hints bl-hint-plate">
        <HintToggle />
      </div>

      <div className="bl-settings__grid">
        <AiSection />
        <GraphicsSection />
      </div>
    </section>
  );
}
