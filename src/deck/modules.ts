import { registerModule } from './registry';

registerModule({
  id: 'mix',
  label: 'Mix',
  order: 10,
  modes: ['rehearsal', 'karaoke', 'concert', 'live'],
  load: () =>
    import('../components/VolumeControls').then(m => ({
      default: m.VolumeControls,
    })),
});

registerModule({
  id: 'tools',
  label: 'Tools',
  order: 20,
  modes: ['rehearsal', 'karaoke', 'concert'],
  load: () =>
    import('../components/ControlPanel').then(m => ({
      default: m.ControlPanel,
    })),
});

registerModule({
  id: 'rec',
  label: 'Rec',
  order: 30,
  modes: ['rehearsal', 'karaoke', 'concert', 'live'],
  load: () =>
    import('../components/RecordingPanel').then(m => ({
      default: m.RecordingPanel,
    })),
});

registerModule({
  id: 'styles',
  label: 'Styles',
  order: 40,
  modes: ['rehearsal', 'karaoke', 'concert'],
  load: () =>
    import('../components/StylesDeck').then(m => ({
      default: m.StylesDeck,
    })),
});

registerModule({
  id: 'ai',
  label: 'AI',
  order: 50,
  modes: ['rehearsal', 'karaoke', 'concert', 'live'],
  load: () =>
    import('../components/AIChatPanel').then(m => ({
      default: m.AIChatPanel,
    })),
});
