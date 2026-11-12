/**
 * A1d — «Lines» открывается для любого имени файла.
 *
 * Пока разбор умел только « - » с пробелами, файл `Metallica-The Unforgiven II`
 * не давал артиста, код выходил с «No track info available», и выбор версий
 * lrclib был мёртв — при том что версий там два десятка.
 */

import { describe, expect, it } from 'vitest';
import { splitArtistTitle } from '../artist-title';

describe('splitArtistTitle', () => {
  it('дефис без пробелов — самый частый вид имени файла', () => {
    expect(splitArtistTitle('Metallica-The Unforgiven II')).toEqual({
      artist: 'Metallica',
      title: 'The Unforgiven II',
    });
  });

  it('дефис с пробелами', () => {
    expect(splitArtistTitle('Metallica - The Unforgiven II')).toEqual({
      artist: 'Metallica',
      title: 'The Unforgiven II',
    });
  });

  it('длинное тире', () => {
    expect(splitArtistTitle('Metallica – The Unforgiven II')).toEqual({
      artist: 'Metallica',
      title: 'The Unforgiven II',
    });
  });

  it('расширение срезается', () => {
    expect(splitArtistTitle('Nirvana - Lounge Act.mp3')).toEqual({
      artist: 'Nirvana',
      title: 'Lounge Act',
    });
  });

  it('название с дефисом внутри не ломается', () => {
    expect(splitArtistTitle('Jay-Z - 99 Problems')).toEqual({
      artist: 'Jay-Z',
      title: '99 Problems',
    });
  });

  it('служебное имя с хешем не даёт артиста-хеша', () => {
    expect(splitArtistTitle('20261112172517-cb73c7d523-metallica-the-unforgiven-ii.mp3')).toEqual({
      artist: '',
      title: '20261112172517-cb73c7d523-metallica-the-unforgiven-ii',
    });
  });

  it('одно слово — только название, без артиста', () => {
    expect(splitArtistTitle('track')).toEqual({ artist: '', title: 'track' });
  });
});
