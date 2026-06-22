// @TC-098-03: PostComposer — создание постов с 4 типами

import { useState, useEffect } from 'react';
import type { FeedPostType } from './feed.types';
import { POST_TYPE_CONFIG } from './feed.types';
import { useFeedStore } from './feed.store';
import { useTrackStore } from '../../stores/track.store';
import { useUserProfileStore } from '../../stores/user-profile.store';

export function PostComposer() {
  const [step, setStep] = useState<'trigger' | 'pick-type' | 'form'>('trigger');
  const [type, setType] = useState<FeedPostType>('post');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [tags, setTags] = useState('');

  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [battleBlockId, setBattleBlockId] = useState('');
  const [battleBlockLabel, setBattleBlockLabel] = useState('');

  const [eventDate, setEventDate] = useState('');
  const [eventPrice, setEventPrice] = useState('');
  const [eventLocation, setEventLocation] = useState('');

  const createPost = useFeedStore(s => s.createPost);
  const editPost = useFeedStore(s => s.editPost);
  const editingPost = useFeedStore(s => s.editingPost);
  const setEditingPost = useFeedStore(s => s.setEditingPost);
  const tracksMeta = useTrackStore(s => s.tracksMeta);
  const user = useUserProfileStore(s => s.currentUser);

  const reset = () => {
    setStep('trigger');
    setType('post');
    setTitle('');
    setText('');
    setTags('');
    setSelectedTrackId('');
    setBattleBlockId('');
    setBattleBlockLabel('');
    setEventDate('');
    setEventPrice('');
    setEventLocation('');
  };

  // Edit mode: prefill from editingPost
  useEffect(() => {
    if (editingPost) {
      setType(editingPost.type);
      setTitle(editingPost.title);
      setText(editingPost.text || '');
      setTags((editingPost.tags || []).join(','));
      setStep('form');
    }
  }, [editingPost]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    const tagsArr = tags.split(',').map(t => t.trim()).filter(Boolean);

    if (editingPost) {
      editPost(editingPost.id, {
        title: title.trim(),
        text: text.trim() || undefined,
        tags: tagsArr.length > 0 ? tagsArr : undefined,
      });
      setEditingPost(null);
      reset();
      return;
    }

    createPost({
      type,
      authorId: user?.id || user?.serverId || 'guest-anon',
      authorName: user?.name || 'Гость',
      authorAvatarUrl: user?.avatarUrl || '',
      title: title.trim(),
      text: text.trim() || undefined,
      tags: tagsArr.length > 0 ? tagsArr : undefined,

      trackId: type === 'track' ? (selectedTrackId || undefined) : undefined,

      baseTrackId: type === 'battle' ? (selectedTrackId || undefined) : undefined,
      battleBlockId: type === 'battle' ? (battleBlockId || undefined) : undefined,
      blocksData: type === 'battle' ? [
        { id: 'b1', label: battleBlockLabel || 'Battle', color: '#FF6B00', startPercent: 0, widthPercent: 100, isActive: true },
      ] : undefined,
      maxSubmissions: type === 'battle' ? 5 : undefined,
      battleStatus: type === 'battle' ? 'open' : undefined,
      submissions: type === 'battle' ? [] : undefined,

      eventDate: eventDate || undefined,
      eventPrice: eventPrice || undefined,
      eventLocation: eventLocation || undefined,

      sourceType: 'manual',
    });

    reset();
  };

  if (step === 'trigger') {
    const avatarInitial = user?.name?.charAt(0)?.toUpperCase() || '?';
    const avatarUrl = user?.avatarUrl;
    return (
      <button className="pc-trigger" onClick={() => setStep('pick-type')}>
        <div className="pc-trigger-left">
          {avatarUrl ? (
            <img className="pc-trigger-avatar" src={avatarUrl} alt="" />
          ) : (
            <div className="pc-trigger-avatar pc-trigger-avatar--fallback">
              {avatarInitial}
            </div>
          )}
          <span>✏️ Что нового?</span>
        </div>
      </button>
    );
  }

  if (step === 'pick-type') {
    return (
      <div className="pc-types-grid">
        {(Object.keys(POST_TYPE_CONFIG) as FeedPostType[]).map(t => {
          const cfg = POST_TYPE_CONFIG[t];
          return (
            <button
              key={t}
              className="pc-type-tile"
              onClick={() => { setType(t); setStep('form'); }}
            >
              <span className="pc-type-emoji">{cfg.emoji}</span>
              <span className="pc-type-label">{cfg.label}</span>
              <span className="pc-type-desc">
                {t === 'post' ? 'мысли, советы' : t === 'track' ? 'кавер, релиз' : t === 'battle' ? '15 сек вокала' : 'ивент, концерт'}
              </span>
            </button>
          );
        })}
        <button className="pc-types-close" onClick={reset}>✕</button>
      </div>
    );
  }

  return (
    <div className="pc-form">
      <div className="pc-form-head">
        <span className="pc-form-type">{POST_TYPE_CONFIG[type].emoji} {POST_TYPE_CONFIG[type].label}</span>
        <button className="pc-form-back" onClick={() => setStep('pick-type')}>← Назад</button>
        <button className="pc-form-close" onClick={reset}>✕</button>
      </div>

      <input className="pc-field" placeholder="Заголовок" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} />

      {type !== 'battle' && (
        <textarea className="pc-field pc-area" placeholder="Описание..." value={text} onChange={e => setText(e.target.value)} maxLength={500} rows={3} />
      )}

      {(type === 'track' || type === 'battle') && (
        <select className="pc-field pc-select" value={selectedTrackId} onChange={e => setSelectedTrackId(e.target.value)}>
          <option value="">Выберите трек...</option>
          {tracksMeta.map(t => (
            <option key={t.id} value={String(t.id)}>{t.title}</option>
          ))}
        </select>
      )}

      {type === 'battle' && (
        <>
          <input className="pc-field" placeholder="ID блока (например: b4)" value={battleBlockId} onChange={e => setBattleBlockId(e.target.value)} />
          <input className="pc-field" placeholder="Название блока (например: Chorus)" value={battleBlockLabel} onChange={e => setBattleBlockLabel(e.target.value)} />
        </>
      )}

      {type === 'event' && (
        <>
          <input className="pc-field" type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} />
          <input className="pc-field" placeholder="Цена" value={eventPrice} onChange={e => setEventPrice(e.target.value)} />
          <input className="pc-field" placeholder="Локация" value={eventLocation} onChange={e => setEventLocation(e.target.value)} />
        </>
      )}

      <input className="pc-field" placeholder="Теги (через запятую)" value={tags} onChange={e => setTags(e.target.value)} />

      <div className="pc-form-foot">
        <button className="pc-send" onClick={handleSubmit} disabled={!title.trim()}>Опубликовать</button>
      </div>
    </div>
  );
}
