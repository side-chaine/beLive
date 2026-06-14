// @TC-089: Linkin Park catalog — static track data

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  year: number;
  slug: string;
  fileName: string;
  r2Key?: string;
}

export const TRACKS: Track[] = [
  // 2000 — Hybrid Theory
  { id: 'lp-01', title: 'Papercut', artist: 'Linkin Park', album: 'Hybrid Theory', year: 2000, slug: 'papercut', fileName: 'Linkin Park - Papercut.zip' },
  { id: 'lp-02', title: 'One Step Closer', artist: 'Linkin Park', album: 'Hybrid Theory', year: 2000, slug: 'one-step-closer', fileName: 'Linkin Park - One Step Closer.zip' },
  { id: 'lp-03', title: 'With You', artist: 'Linkin Park', album: 'Hybrid Theory', year: 2000, slug: 'with-you', fileName: 'Linkin Park - With You.zip' },
  { id: 'lp-04', title: 'Points of Authority', artist: 'Linkin Park', album: 'Hybrid Theory', year: 2000, slug: 'points-of-authority', fileName: 'Linkin Park - Points of Authority.zip' },
  { id: 'lp-05', title: 'Crawling', artist: 'Linkin Park', album: 'Hybrid Theory', year: 2000, slug: 'crawling', fileName: 'Linkin Park - Crawling.zip' },
  { id: 'lp-06', title: 'Runaway', artist: 'Linkin Park', album: 'Hybrid Theory', year: 2000, slug: 'runaway', fileName: 'Linkin Park - Runaway.zip' },
  { id: 'lp-07', title: 'By Myself', artist: 'Linkin Park', album: 'Hybrid Theory', year: 2000, slug: 'by-myself', fileName: 'Linkin Park - By Myself.zip' },
  { id: 'lp-08', title: 'In the End', artist: 'Linkin Park', album: 'Hybrid Theory', year: 2000, slug: 'in-the-end', fileName: 'Linkin Park - In the End.zip' },
  { id: 'lp-09', title: 'A Place for My Head', artist: 'Linkin Park', album: 'Hybrid Theory', year: 2000, slug: 'a-place-for-my-head', fileName: 'Linkin Park - A Place for My Head.zip' },
  { id: 'lp-10', title: 'Forgotten', artist: 'Linkin Park', album: 'Hybrid Theory', year: 2000, slug: 'forgotten', fileName: 'Linkin Park - Forgotten.zip' },
  { id: 'lp-11', title: 'Cure for the Itch', artist: 'Linkin Park', album: 'Hybrid Theory', year: 2000, slug: 'cure-for-the-itch', fileName: 'Linkin Park - Cure for the Itch.zip' },
  { id: 'lp-12', title: 'Pushing Me Away', artist: 'Linkin Park', album: 'Hybrid Theory', year: 2000, slug: 'pushing-me-away', fileName: 'Linkin Park - Pushing Me Away.zip' },
  { id: 'lp-13', title: 'High Voltage', artist: 'Linkin Park', album: 'Hybrid Theory', year: 2000, slug: 'high-voltage', fileName: 'Linkin Park - High Voltage [bonus track].zip' },
  { id: 'lp-14', title: 'My December', artist: 'Linkin Park', album: 'Hybrid Theory', year: 2000, slug: 'my-december', fileName: 'Linkin Park - My December [bonus track].zip' },
  // 2003 — Meteora
  { id: 'lp-15', title: 'Foreword', artist: 'Linkin Park', album: 'Meteora', year: 2003, slug: 'foreword', fileName: 'Linkin Park - Foreword.zip' },
  { id: 'lp-16', title: "Don't Stay", artist: 'Linkin Park', album: 'Meteora', year: 2003, slug: 'dont-stay', fileName: "Linkin Park - Don't Stay.zip" },
  { id: 'lp-17', title: 'Somewhere I Belong', artist: 'Linkin Park', album: 'Meteora', year: 2003, slug: 'somewhere-i-belong', fileName: 'Linkin Park - Somewhere I Belong.zip' },
  { id: 'lp-18', title: 'Lying from You', artist: 'Linkin Park', album: 'Meteora', year: 2003, slug: 'lying-from-you', fileName: 'Linkin Park - Lying From You.zip' },
  { id: 'lp-19', title: 'Hit the Floor', artist: 'Linkin Park', album: 'Meteora', year: 2003, slug: 'hit-the-floor', fileName: 'Linkin Park - Hit the Floor.zip' },
  { id: 'lp-20', title: 'Easier to Run', artist: 'Linkin Park', album: 'Meteora', year: 2003, slug: 'easier-to-run', fileName: 'Linkin Park - Easier to Run.zip' },
  { id: 'lp-21', title: 'Faint', artist: 'Linkin Park', album: 'Meteora', year: 2003, slug: 'faint', fileName: 'Linkin Park - Faint.zip' },
  { id: 'lp-22', title: 'Figure.09', artist: 'Linkin Park', album: 'Meteora', year: 2003, slug: 'figure-09', fileName: 'Linkin Park - Figure.09.zip' },
  { id: 'lp-23', title: 'Breaking the Habit', artist: 'Linkin Park', album: 'Meteora', year: 2003, slug: 'breaking-the-habit', fileName: 'Linkin Park - Breaking the Habit.zip' },
  { id: 'lp-24', title: 'From the Inside', artist: 'Linkin Park', album: 'Meteora', year: 2003, slug: 'from-the-inside', fileName: 'Linkin Park - From the Inside.zip' },
  { id: 'lp-25', title: "Nobody's Listening", artist: 'Linkin Park', album: 'Meteora', year: 2003, slug: 'nobodys-listening', fileName: "Linkin Park - Nobody's Listening.zip" },
  { id: 'lp-26', title: 'Session', artist: 'Linkin Park', album: 'Meteora', year: 2003, slug: 'session', fileName: 'Linkin Park - Session.zip' },
  { id: 'lp-27', title: 'Numb', artist: 'Linkin Park', album: 'Meteora', year: 2003, slug: 'numb', fileName: 'Linkin Park - Numb.zip' },
  // 2007 — Minutes to Midnight
  { id: 'lp-28', title: 'Given Up', artist: 'Linkin Park', album: 'Minutes to Midnight', year: 2007, slug: 'given-up', fileName: 'Linkin Park - Given Up.zip' },
  { id: 'lp-29', title: 'Leave Out All the Rest', artist: 'Linkin Park', album: 'Minutes to Midnight', year: 2007, slug: 'leave-out-all-the-rest', fileName: 'Linkin Park - Leave Out All the Rest.zip' },
  { id: 'lp-30', title: 'Bleed It Out', artist: 'Linkin Park', album: 'Minutes to Midnight', year: 2007, slug: 'bleed-it-out', fileName: 'Linkin Park - Bleed It Out.zip' },
  { id: 'lp-31', title: 'Shadow of the Day', artist: 'Linkin Park', album: 'Minutes to Midnight', year: 2007, slug: 'shadow-of-the-day', fileName: 'Linkin Park - Shadow of the Day.zip' },
  { id: 'lp-32', title: "What I've Done", artist: 'Linkin Park', album: 'Minutes to Midnight', year: 2007, slug: 'what-ive-done', fileName: "Linkin Park - What I've Done.zip" },
  // 2010 — A Thousand Suns
  { id: 'lp-33', title: 'The Requiem', artist: 'Linkin Park', album: 'A Thousand Suns', year: 2010, slug: 'the-requiem', fileName: 'Linkin Park - The Requiem.zip' },
  { id: 'lp-34', title: 'The Radiance', artist: 'Linkin Park', album: 'A Thousand Suns', year: 2010, slug: 'the-radiance', fileName: 'Linkin Park - The Radiance.zip' },
  { id: 'lp-35', title: 'Burning in the Skies', artist: 'Linkin Park', album: 'A Thousand Suns', year: 2010, slug: 'burning-in-the-skies', fileName: 'Linkin Park - Burning In The Skies.zip' },
  { id: 'lp-36', title: 'Empty Spaces', artist: 'Linkin Park', album: 'A Thousand Suns', year: 2010, slug: 'empty-spaces', fileName: 'Linkin Park - Empty Spaces.zip' },
  { id: 'lp-37', title: 'When They Come for Me', artist: 'Linkin Park', album: 'A Thousand Suns', year: 2010, slug: 'when-they-come-for-me', fileName: 'Linkin Park - When They Come For Me.zip' },
  { id: 'lp-38', title: 'Robot Boy', artist: 'Linkin Park', album: 'A Thousand Suns', year: 2010, slug: 'robot-boy', fileName: 'Linkin Park - Robot Boy.zip' },
  { id: 'lp-39', title: 'Jornada del Muerto', artist: 'Linkin Park', album: 'A Thousand Suns', year: 2010, slug: 'jornada-del-muerto', fileName: 'Linkin Park - Jornada Del Muerto.zip' },
  { id: 'lp-40', title: 'Waiting for the End', artist: 'Linkin Park', album: 'A Thousand Suns', year: 2010, slug: 'waiting-for-the-end', fileName: 'Linkin Park - Waiting For The End.zip' },
  { id: 'lp-41', title: 'Blackout', artist: 'Linkin Park', album: 'A Thousand Suns', year: 2010, slug: 'blackout', fileName: 'Linkin Park - Blackout.zip' },
  { id: 'lp-42', title: 'Wretches and Kings', artist: 'Linkin Park', album: 'A Thousand Suns', year: 2010, slug: 'wretches-and-kings', fileName: 'Linkin Park - Wretches And Kings.zip' },
  { id: 'lp-43', title: 'Wisdom, Justice, and Love', artist: 'Linkin Park', album: 'A Thousand Suns', year: 2010, slug: 'wisdom-justice-and-love', fileName: 'Linkin Park - Wisdom, Justice, And Love.zip' },
  { id: 'lp-44', title: 'Iridescent', artist: 'Linkin Park', album: 'A Thousand Suns', year: 2010, slug: 'iridescent', fileName: 'Linkin Park - Iridescent.zip' },
  { id: 'lp-45', title: 'Fallout', artist: 'Linkin Park', album: 'A Thousand Suns', year: 2010, slug: 'fallout', fileName: 'Linkin Park - Fallout.zip' },
  { id: 'lp-46', title: 'The Catalyst', artist: 'Linkin Park', album: 'A Thousand Suns', year: 2010, slug: 'the-catalyst', fileName: 'Linkin Park - The Catalyst.zip' },
  { id: 'lp-47', title: 'The Messenger', artist: 'Linkin Park', album: 'A Thousand Suns', year: 2010, slug: 'the-messenger', fileName: 'Linkin Park - The Messenger.zip' },
  // 2012 — Living Things
  { id: 'lp-48', title: 'Castle of Glass', artist: 'Linkin Park', album: 'Living Things', year: 2012, slug: 'castle-of-glass', fileName: 'Linkin Park - Castle Of Glass.zip' },
  { id: 'lp-49', title: 'Skin to Bone', artist: 'Linkin Park', album: 'Living Things', year: 2012, slug: 'skin-to-bone', fileName: 'Linkin Park - Skin To Bone.zip' },
  // 2014 — The Hunting Party
  { id: 'lp-50', title: 'Final Masquerade', artist: 'Linkin Park', album: 'The Hunting Party', year: 2014, slug: 'final-masquerade', fileName: 'Linkin Park - Final Masquerade.zip' },
  // 2017 — One More Light
  { id: 'lp-51', title: 'One More Light', artist: 'Linkin Park', album: 'One More Light', year: 2017, slug: 'one-more-light', fileName: 'Linkin Park - One More Light.zip' },
  { id: 'lp-52', title: 'Talking to Myself', artist: 'Linkin Park', album: 'One More Light', year: 2017, slug: 'talking-to-myself', fileName: 'Linkin Park - Talking To Myself.zip' },
];

export const TRACKS_PER_PAGE = 10;

export function getTracksPage(page: number): { tracks: Track[]; total: number; pages: number } {
  const total = TRACKS.length;
  const pages = Math.ceil(total / TRACKS_PER_PAGE);
  const start = (page - 1) * TRACKS_PER_PAGE;
  const tracks = TRACKS.slice(start, start + TRACKS_PER_PAGE);
  return { tracks, total, pages };
}

export function findTrack(query: string): Track | null {
  const q = query.toLowerCase();
  return TRACKS.find(t => 
    t.title.toLowerCase().includes(q) || 
    t.slug.toLowerCase().includes(q)
  ) || null;
}

export function getTrackBySlug(slug: string): Track | null {
  return TRACKS.find(t => t.slug === slug) || null;
}
