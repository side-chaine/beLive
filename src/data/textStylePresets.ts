/* F21: Style presets — migrated from legacy TSM._initStyles() */
import type { TextStylePreset } from '../types/textStyle.types';

export const TEXT_STYLE_PRESETS: Record<string, TextStylePreset> = {
  default: {
    id: 'default', name: 'По умолчанию',
    description: 'Чистый, читаемый стиль для повседневного использования',
    category: 'basic', cssClass: 'style-default', containerClass: 'container-default',
    transition: 'fade',
    options: { textAlign: 'center', fontSize: '1.2em', lineSpacing: '1.6',
      fontFamily: 'Arial, sans-serif', textColor: '#ffffff', backgroundColor: 'transparent' },
  },
  elegant: {
    id: 'elegant', name: 'Элегантный',
    description: 'Изысканная типографика для особых случаев',
    category: 'basic', cssClass: 'style-elegant', containerClass: 'container-elegant',
    transition: 'slide',
    options: { textAlign: 'center', fontSize: '1.3em', lineSpacing: '1.8',
      fontFamily: '"Playfair Display", serif', textColor: '#ffffff', backgroundColor: 'transparent' },
  },
  bold: {
    id: 'bold', name: 'Яркий',
    description: 'Высококонтрастный стиль с выразительной типографикой',
    category: 'basic', cssClass: 'style-bold', containerClass: 'container-bold',
    transition: 'zoom',
    options: { textAlign: 'center', fontSize: '1.4em', lineSpacing: '1.5',
      fontFamily: '"Montserrat", sans-serif', textColor: '#ffffff', backgroundColor: 'transparent',
      fontWeight: 'bold' },
  },
  modern: {
    id: 'modern', name: 'Современный',
    description: 'Современный стиль с чистыми линиями',
    category: 'basic', cssClass: 'style-modern', containerClass: 'container-modern',
    transition: 'slide-up',
    options: { textAlign: 'center', fontSize: '1.25em', lineSpacing: '1.7',
      fontFamily: '"Roboto", sans-serif', textColor: '#ffffff', backgroundColor: 'transparent' },
  },
  classic: {
    id: 'classic', name: 'Классический',
    description: 'Традиционная типографика для чтения',
    category: 'basic', cssClass: 'style-classic', containerClass: 'container-classic',
    transition: 'fade',
    options: { textAlign: 'center', fontSize: '1.2em', lineSpacing: '1.8',
      fontFamily: '"Merriweather", serif', textColor: '#ffffff', backgroundColor: 'transparent' },
  },
  presentation: {
    id: 'presentation', name: 'Презентация',
    description: 'Оптимизирован для отображения на экранах и проекторах',
    category: 'performance', cssClass: 'style-presentation', containerClass: 'container-presentation',
    transition: 'slide',
    options: { textAlign: 'center', fontSize: '2.0em', lineSpacing: '1.5',
      fontFamily: 'Arial, sans-serif', textColor: '#ffffff', backgroundColor: 'transparent' },
  },
  minimalist: {
    id: 'minimalist', name: 'Минималистичный',
    description: 'Чистый, фокусированный стиль, идеален для концентрации',
    category: 'performance', cssClass: 'style-minimalist', containerClass: 'container-minimalist',
    transition: 'fade',
    options: { textAlign: 'center', fontSize: '1.1em', lineSpacing: '2',
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      textColor: '#ffffff', backgroundColor: 'transparent' },
  },
  karaoke: {
    id: 'karaoke', name: 'Караоке',
    description: 'Стиль с подсветкой текущей строки и выделением',
    category: 'hidden', cssClass: 'style-karaoke', containerClass: 'container-karaoke',
    transition: 'slide-up',
    options: { textAlign: 'center', fontSize: '1.4em', lineSpacing: '1.8',
      fontFamily: "'Times New Roman', Times, serif", textColor: '#ffffff',
      backgroundColor: 'transparent' },
  },
  concert: {
    id: 'concert', name: 'Концертный',
    description: 'Крупный, контрастный текст для выступлений',
    category: 'hidden', cssClass: 'style-concert', containerClass: 'container-concert',
    transition: 'zoom',
    options: { textAlign: 'center', fontSize: '1.6em', lineSpacing: '1.6',
      fontFamily: '"Oswald", sans-serif', textColor: '#ffffff', backgroundColor: 'transparent',
      fontWeight: 'bold' },
  },
  neonGlow: {
    id: 'neonGlow', name: 'Неоновое Свечение',
    description: 'Стилизованный текст с эффектом неонового свечения',
    category: 'creative', cssClass: 'style-neon-glow', containerClass: 'container-neon',
    transition: 'fade',
    options: { textAlign: 'center', fontSize: '1.4em', lineSpacing: '1.8',
      fontFamily: '"Orbitron", sans-serif', textColor: '#ffffff', backgroundColor: 'transparent',
      textShadow: '0 0 5px #fff, 0 0 10px #fff, 0 0 15px #0073e6, 0 0 20px #0073e6' },
  },
  rehearsal: {
    id: 'rehearsal', name: 'Репетиция',
    description: 'Режим для репетиций с отображением блоков текста',
    category: 'hidden', cssClass: 'style-rehearsal', containerClass: 'container-rehearsal',
    transition: 'fade',
    options: { textAlign: 'center', fontFamily: 'Arial, sans-serif' },
  },
  live: {
    id: 'live', name: 'Live',
    description: 'Режим Live с видео, камерой и эффектами',
    category: 'hidden', cssClass: 'style-live', containerClass: 'container-live',
    transition: 'fade',
    options: { textAlign: 'center', fontSize: '1.6em', lineSpacing: '1.8',
      fontFamily: '"Roboto", sans-serif', textColor: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  },
};

export function getStylePreset(id: string): TextStylePreset | null {
  return TEXT_STYLE_PRESETS[id] ?? null;
}

/* Expose to legacy layer — TSM proxy reads via window.__TEXT_STYLE_PRESETS */
(window as any).__TEXT_STYLE_PRESETS = TEXT_STYLE_PRESETS;
