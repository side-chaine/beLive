-- Sections
INSERT OR IGNORE INTO feed_sections (id, title, type, sort_order) VALUES 
  ('featured', 'Избранное', 'hero-stack', 0),
  ('events', 'Ближайшие мероприятия', 'list', 1),
  ('tracks', 'Новинки', 'scroll', 2);

-- Test items
INSERT OR IGNORE INTO feed_items (id, type, title, subtitle, description, status, priority, event_date, price) VALUES
  ('f1', 'event', 'Мастер-класс: Джаз', 'Анна К.', 'Основы импровизации', 'published', 10, '2026-07-01', '1500₽'),
  ('e1', 'event', 'Вокальный вечер', 'Студия beLive', 'Онлайн стрим', 'published', 0, '2026-06-20', 'Бесплатно');

-- Test poll (Elo rails)
INSERT OR IGNORE INTO feed_items (id, type, title, status, priority, data) VALUES
  ('p1', 'poll', '🏆 Лучшее приложение для вокалистов 2026', 'published', 5, '{"options": [{"id": "opt1", "title": "Vocal Pitch Monitor", "votes": 12}, {"id": "opt2", "title": "SingTrue", "votes": 8}]}');

-- Section-item links
INSERT OR IGNORE INTO feed_section_items (section_id, item_id, sort_order) VALUES 
  ('featured', 'f1', 0),
  ('featured', 'p1', 1),
  ('events', 'e1', 0);
