import { useEffect, useRef } from 'react';

interface Props {
  /** Имя бота без @, у которого в BotFather задан /setdomain app.mybelive.com */
  botName: string;
  authUrl: string;
}

/**
 * Telegram Login Widget.
 * Telegram отдаёт готовую кнопку через <script>, поэтому вставляем её вручную.
 * После подтверждения Telegram редиректит на authUrl с подписанными полями,
 * подпись проверяется на воркере (HMAC-SHA256 с токеном бота).
 */
export function TelegramLoginButton({ botName, authUrl }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host || !botName) return;
    host.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'true');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-auth-url', authUrl);
    script.setAttribute('data-request-access', 'write');
    host.appendChild(script);

    return () => {
      host.innerHTML = '';
    };
  }, [botName, authUrl]);

  return <div ref={ref} className="bl-welcome__tg" />;
}
