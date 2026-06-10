import { describe, it, expect } from 'vitest';
import { authService } from '../auth.service';

describe('auth.service — чистые функции', () => {
  describe('_decodeBase64Url', () => {
    it('декодирует простой JSON', () => {
      const payload = btoa(JSON.stringify({ sub: '123' }));
      const urlSafe = payload.replace(/\+/g, '-').replace(/\//g, '_');
      const result = authService._decodeBase64Url(urlSafe);
      expect(JSON.parse(result)).toEqual({ sub: '123' });
    });

    it('обрабатывает паддинг', () => {
      const payload = btoa('a');
      const urlSafe = payload.replace(/\+/g, '-').replace(/\//g, '_');
      const result = authService._decodeBase64Url(urlSafe);
      expect(result).toBe('a');
    });
  });

  describe('_isTokenValid', () => {
    it('валидный токен (exp в будущем) возвращает true', () => {
      const token = authService._generateMockJWT();
      expect(authService._isTokenValid(token)).toBe(true);
    });

    it('токен с 3 частями — валидный формат', () => {
      const token = authService._generateMockJWT();
      expect(token.split('.').length).toBe(3);
    });

    it('невалидный формат (2 части) возвращает false', () => {
      expect(authService._isTokenValid('header.payload')).toBe(false);
    });

    it('пустой токен возвращает false', () => {
      expect(authService._isTokenValid('')).toBe(false);
    });

    it('exp = 0 (истёк) возвращает false', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ sub: 'test', exp: 0 }));
      const sig = btoa('sig');
      const token = `${header}.${payload}.${sig}`;
      expect(authService._isTokenValid(token)).toBe(false);
    });
  });

  describe('_generateMockJWT', () => {
    it('создаёт JWT с 3 частями через точки', () => {
      const token = authService._generateMockJWT();
      expect(token.split('.').length).toBe(3);
    });

    it('содержит mock-user-id в payload', () => {
      const token = authService._generateMockJWT();
      const payload = JSON.parse(authService._decodeBase64Url(token.split('.')[1]));
      expect(payload.sub).toBe('mock-user-id');
    });
  });

  describe('handleCallback', () => {
    it('без auth параметра возвращает null', async () => {
      const params = new URLSearchParams('');
      const result = await authService.handleCallback(params);
      expect(result).toBeNull();
    });

    it('с валидным auth токеном возвращает данные', async () => {
      const token = authService._generateMockJWT();
      const params = new URLSearchParams(`auth=${token}&name=Test&email=test@test.com`);
      const result = await authService.handleCallback(params);
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Test');
      expect(result!.email).toBe('test@test.com');
      expect(result!.authToken).toBe(token);
    });
  });
});
