-- PuppyTrack — Supabase Schema (güncel hal)
-- Son güncelleme: 2026-06-21

-- ── Tablolar ─────────────────────────────────────────────────────────

create table dogs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  name         text not null,
  breed        text not null default '',
  breed_size   text not null check (breed_size in ('small', 'medium', 'large', 'giant')),
  age_months   int  not null default 2,
  birth_date   text,
  home         text not null check (home in ('apartment', 'garden')),
  avatar       text not null default '🐶',
  level        int  not null default 1 check (level between 1 and 5),
  water_offset int  not null default 30,   -- su→çiş tahmini (dakika)
  food_offset  int  not null default 30,   -- mama→kaka tahmini (dakika)
  created_at   timestamptz default now()
);

create table training_logs (
  id          uuid primary key default gen_random_uuid(),
  dog_id      uuid references dogs(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  date        text not null,   -- 'DD.MM.YYYY'
  type        text not null check (type in ('success', 'accident')),
  sub         text not null check (sub in ('pee', 'poop', 'both')),
  time        text not null,   -- 'HH:MM'
  location    text not null default 'indoor' check (location in ('indoor', 'outdoor')),
  created_at  timestamptz default now()
);

create table feeding_logs (
  id         uuid primary key,
  dog_id     uuid references dogs(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  type       text check (type in ('water', 'food')),
  timestamp  timestamptz not null,
  source     text check (source in ('manual', 'scheduled')),
  created_at timestamptz default now()
);

create table anon_training_data (
  id         uuid default gen_random_uuid() primary key,
  type       text not null,
  sub        text not null,
  hour       smallint not null,
  breed_size text not null,
  home_type  text not null,
  age_group  text not null,
  created_at timestamptz default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────

alter table dogs              enable row level security;
alter table training_logs     enable row level security;
alter table feeding_logs      enable row level security;
alter table anon_training_data enable row level security;

create policy "own dogs"
  on dogs for all using (auth.uid() = user_id);

create policy "own logs"
  on training_logs for all using (auth.uid() = user_id);

create policy "Users manage own feeding logs"
  on feeding_logs for all using (auth.uid() = user_id);

create policy "authenticated insert"
  on anon_training_data for insert to authenticated with check (true);

-- ── Migration: yeni kolonlar ──────────────────────────────────────────
ALTER TABLE dogs ADD COLUMN IF NOT EXISTS water_pair_count INT NOT NULL DEFAULT 0;
ALTER TABLE dogs ADD COLUMN IF NOT EXISTS food_pair_count  INT NOT NULL DEFAULT 0;

-- ── Trigger: feeding offset + pair count güncelleme ───────────────────
-- Her su→çiş veya mama→kaka eşleşmesinde sayacı artırır.
-- Sayaç 10'un katına ulaşınca son 10 eşleşmenin ortalamasını water/food_offset'e yazar.

DROP TRIGGER IF EXISTS feeding_offset_updater ON training_logs;
DROP FUNCTION IF EXISTS update_feeding_offsets();

CREATE OR REPLACE FUNCTION update_feeding_offsets()
RETURNS TRIGGER AS $$
DECLARE
  v_dog_id UUID := NEW.dog_id;
  v_log_ts TIMESTAMPTZ;
  v_new_count INT;
  v_avg NUMERIC;
BEGIN
  v_log_ts := to_timestamp(NEW.date || ' ' || NEW.time, 'DD.MM.YYYY HH24:MI')
              AT TIME ZONE 'Europe/Istanbul';

  -- Su → Çiş: bu kayıt için eşleşen water var mı?
  IF NEW.sub IN ('pee', 'both') THEN
    IF EXISTS (
      SELECT 1 FROM feeding_logs fl
      WHERE fl.dog_id = v_dog_id AND fl.type = 'water'
        AND fl.timestamp < v_log_ts
        AND fl.timestamp > v_log_ts - INTERVAL '2 hours'
    ) THEN
      UPDATE dogs SET water_pair_count = water_pair_count + 1
      WHERE id = v_dog_id
      RETURNING water_pair_count INTO v_new_count;

      IF v_new_count % 10 = 0 THEN
        SELECT AVG(delta) INTO v_avg FROM (
          SELECT EXTRACT(EPOCH FROM (
            to_timestamp(tl.date||' '||tl.time, 'DD.MM.YYYY HH24:MI') AT TIME ZONE 'Europe/Istanbul'
            - (SELECT MAX(fl.timestamp) FROM feeding_logs fl
               WHERE fl.dog_id = v_dog_id AND fl.type = 'water'
                 AND fl.timestamp < to_timestamp(tl.date||' '||tl.time, 'DD.MM.YYYY HH24:MI') AT TIME ZONE 'Europe/Istanbul'
                 AND fl.timestamp > to_timestamp(tl.date||' '||tl.time, 'DD.MM.YYYY HH24:MI') AT TIME ZONE 'Europe/Istanbul' - INTERVAL '2 hours')
          )) / 60 AS delta
          FROM training_logs tl
          WHERE tl.dog_id = v_dog_id AND tl.sub IN ('pee', 'both')
            AND EXISTS (
              SELECT 1 FROM feeding_logs fl
              WHERE fl.dog_id = v_dog_id AND fl.type = 'water'
                AND fl.timestamp < to_timestamp(tl.date||' '||tl.time, 'DD.MM.YYYY HH24:MI') AT TIME ZONE 'Europe/Istanbul'
                AND fl.timestamp > to_timestamp(tl.date||' '||tl.time, 'DD.MM.YYYY HH24:MI') AT TIME ZONE 'Europe/Istanbul' - INTERVAL '2 hours'
            )
          ORDER BY to_timestamp(tl.date||' '||tl.time, 'DD.MM.YYYY HH24:MI') DESC
          LIMIT 10
        ) t;
        IF v_avg IS NOT NULL THEN
          UPDATE dogs SET water_offset = GREATEST(5, LEAST(120, ROUND(v_avg))) WHERE id = v_dog_id;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Mama → Kaka: bu kayıt için eşleşen food var mı?
  IF NEW.sub IN ('poop', 'both') THEN
    IF EXISTS (
      SELECT 1 FROM feeding_logs fl
      WHERE fl.dog_id = v_dog_id AND fl.type = 'food'
        AND fl.timestamp < v_log_ts
        AND fl.timestamp > v_log_ts - INTERVAL '4 hours'
    ) THEN
      UPDATE dogs SET food_pair_count = food_pair_count + 1
      WHERE id = v_dog_id
      RETURNING food_pair_count INTO v_new_count;

      IF v_new_count % 10 = 0 THEN
        SELECT AVG(delta) INTO v_avg FROM (
          SELECT EXTRACT(EPOCH FROM (
            to_timestamp(tl.date||' '||tl.time, 'DD.MM.YYYY HH24:MI') AT TIME ZONE 'Europe/Istanbul'
            - (SELECT MAX(fl.timestamp) FROM feeding_logs fl
               WHERE fl.dog_id = v_dog_id AND fl.type = 'food'
                 AND fl.timestamp < to_timestamp(tl.date||' '||tl.time, 'DD.MM.YYYY HH24:MI') AT TIME ZONE 'Europe/Istanbul'
                 AND fl.timestamp > to_timestamp(tl.date||' '||tl.time, 'DD.MM.YYYY HH24:MI') AT TIME ZONE 'Europe/Istanbul' - INTERVAL '4 hours')
          )) / 60 AS delta
          FROM training_logs tl
          WHERE tl.dog_id = v_dog_id AND tl.sub IN ('poop', 'both')
            AND EXISTS (
              SELECT 1 FROM feeding_logs fl
              WHERE fl.dog_id = v_dog_id AND fl.type = 'food'
                AND fl.timestamp < to_timestamp(tl.date||' '||tl.time, 'DD.MM.YYYY HH24:MI') AT TIME ZONE 'Europe/Istanbul'
                AND fl.timestamp > to_timestamp(tl.date||' '||tl.time, 'DD.MM.YYYY HH24:MI') AT TIME ZONE 'Europe/Istanbul' - INTERVAL '4 hours'
            )
          ORDER BY to_timestamp(tl.date||' '||tl.time, 'DD.MM.YYYY HH24:MI') DESC
          LIMIT 10
        ) t;
        IF v_avg IS NOT NULL THEN
          UPDATE dogs SET food_offset = GREATEST(5, LEAST(120, ROUND(v_avg))) WHERE id = v_dog_id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER feeding_offset_updater
AFTER INSERT ON training_logs
FOR EACH ROW EXECUTE FUNCTION update_feeding_offsets();
