import { registerModule } from './registry';

// v2.0: Mix controls moved to always-on dock bar (TC-DOCK-05/06/08/10).
// registerModule({
//   id: 'mix',
//   label: 'Mix',
//   order: 10,
//   modes: ['rehearsal', 'karaoke', 'concert', 'live'],
//   load: () =>
//     import('../components/VolumeControls').then(m => ({
//       default: m.VolumeControls,
//     })),
// });

// v2.0: Tools split — Sync/Monitor/Pitch on dock bar, Blocks in Sync panel (TC-DOCK-19).
// registerModule({
//   id: 'tools',
//   label: 'Tools',
//   order: 20,
//   modes: ['rehearsal', 'karaoke', 'concert'],
//   load: () =>
//     import('../components/ControlPanel').then(m => ({
//       default: m.ControlPanel,
//     })),
// });

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
  order: 38,
  modes: ['rehearsal', 'karaoke', 'concert'],
  load: () =>
    import('../components/StylesDeck').then(m => ({
      default: m.StylesDeck,
    })),
});

// v2.0: AI deferred. Infrastructure preserved in src/js/ai/.
// registerModule({
//   id: 'ai',
//   label: 'AI',
//   order: 50,
//   modes: ['rehearsal', 'karaoke', 'concert', 'live'],
//   load: () =>
//     import('../components/AIChatPanel').then(m => ({
//       default: m.AIChatPanel,
//     })),
// });

registerModule({
  id: 'takes',
  label: 'Quest',
  order: 28,
  modes: ['rehearsal', 'karaoke', 'concert'],
  load: () =>
    import('../takes/components/TakesPanel').then(m => ({
      default: m.TakesPanel,
    })),
});

registerModule({
  id: 'mixer',
  label: 'Studio',
  order: 25,
  modes: ['rehearsal', 'karaoke', 'concert'],
  load: () =>
    import('../components/MixerPanel').then(m => ({
      default: m.MixerPanel,
    })),
});

registerModule({
  id: 'monitor',
  label: 'Split',
  order: 35,
  modes: ['rehearsal', 'karaoke', 'concert', 'live'],
  load: () =>
    import('../components/MonitorMixPanel').then(m => ({
      default: m.MonitorMixPanel,
    })),
});

// TC-RENAME-PITCH: Pitch detection tab renamed to Notes for user clarity
registerModule({
  id: 'pitch',
  label: 'Notes',
  order: 40,
  modes: ['rehearsal', 'karaoke', 'concert'],
  load: () =>
    import('../components/PitchTab').then(m => ({
      default: m.PitchTab,
    })),
});

registerModule({
  id: 'billy',
  label: '🤖',
  order: 45,
  modes: ['rehearsal', 'karaoke', 'concert', 'live'],
  load: () => import('./BillyChatModule').then(m => ({ default: m.BillyChatModule })),
});


