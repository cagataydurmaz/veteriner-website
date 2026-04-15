-- =============================================================================
-- 20260413_postgis_proximity.sql
-- PostGIS proximity engine for veterinarian location-based search
--
-- Prerequisites:
--   • PostGIS extension must be enabled in your Supabase project.
--     Dashboard → Database → Extensions → postgis → Enable
--
-- What this migration does:
--   1. Enables the postgis extension (idempotent)
--   2. Adds `location geography(POINT,4326)` to veterinarians
--   3. Creates a GIST spatial index for fast distance queries
--   4. Back-fills approximate city-centroid coordinates for existing rows
--   5. Creates `get_vets_by_proximity` RPC used by the listing pages
--   6. Adds storage RLS policies so the service_role key can upload diplomas
-- =============================================================================

-- ── 1. Enable PostGIS ─────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;

-- ── 2. Add geography column ───────────────────────────────────────────────────
ALTER TABLE veterinarians
  ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

-- ── 3. Spatial index ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_veterinarians_location
  ON veterinarians USING GIST (location);

-- ── 4. Back-fill city centroids ───────────────────────────────────────────────
-- Approximate WGS-84 centroids for Turkish provinces.
-- Rows with unmapped cities will keep location = NULL and fall back to
-- text-based city filtering in the application layer.
UPDATE veterinarians SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
FROM (VALUES
  ('Adana',           35.3213, 37.0),
  ('Adıyaman',        38.2786, 37.7648),
  ('Afyonkarahisar',  30.5567, 38.7507),
  ('Ağrı',            43.0503, 39.7191),
  ('Amasya',          35.8353, 40.6499),
  ('Ankara',          32.8597, 39.9334),
  ('Antalya',         30.7133, 36.8969),
  ('Artvin',          41.8183, 41.1828),
  ('Aydın',           27.8416, 37.856),
  ('Balıkesir',       27.8826, 39.6484),
  ('Bilecik',         29.9792, 40.1506),
  ('Bingöl',          40.4982, 38.8854),
  ('Bitlis',          42.1232, 38.3938),
  ('Bolu',            31.6061, 40.7359),
  ('Burdur',          30.2914, 37.7266),
  ('Bursa',           29.0610, 40.1885),
  ('Çanakkale',       26.4142, 40.1553),
  ('Çankırı',         33.6134, 40.6013),
  ('Çorum',           34.9556, 40.5506),
  ('Denizli',         29.0864, 37.7765),
  ('Diyarbakır',      40.2306, 37.9144),
  ('Düzce',           31.1565, 40.844),
  ('Edirne',          26.5623, 41.6818),
  ('Elazığ',          39.2264, 38.6810),
  ('Erzincan',        39.5,    39.75),
  ('Erzurum',         41.2671, 39.9208),
  ('Eskişehir',       30.5206, 39.7767),
  ('Gaziantep',       37.3833, 37.0662),
  ('Giresun',         38.3895, 40.9128),
  ('Gümüşhane',       39.4814, 40.4386),
  ('Hakkari',         43.7408, 37.5744),
  ('Hatay',           36.3498, 36.4018),
  ('Iğdır',           44.0453, 39.9237),
  ('Isparta',         30.5566, 37.7648),
  ('İstanbul',        28.9784, 41.0082),
  ('İzmir',           27.1287, 38.4192),
  ('Kahramanmaraş',   36.9371, 37.5858),
  ('Karabük',         32.6204, 41.2061),
  ('Karaman',         33.2287, 37.1759),
  ('Kars',            43.0975, 40.6013),
  ('Kastamonu',       33.7827, 41.3887),
  ('Kayseri',         35.4787, 38.7312),
  ('Kilis',           37.1212, 36.7184),
  ('Kırıkkale',       33.5153, 39.8468),
  ('Kırklareli',      27.2253, 41.735),
  ('Kırşehir',        34.1709, 39.1425),
  ('Kocaeli',         29.8815, 40.8533),
  ('Konya',           32.4932, 37.8746),
  ('Kütahya',         29.9833, 39.4167),
  ('Malatya',         38.3095, 38.3552),
  ('Manisa',          27.4289, 38.6191),
  ('Mardin',          40.7245, 37.3212),
  ('Mersin',          34.6415, 36.8121),
  ('Muğla',           28.3636, 37.2153),
  ('Muş',             41.5064, 38.7458),
  ('Nevşehir',        34.6857, 38.6939),
  ('Niğde',           34.6833, 37.9667),
  ('Ordu',            37.8797, 40.9862),
  ('Osmaniye',        36.2468, 37.0742),
  ('Rize',            40.5234, 41.0201),
  ('Sakarya',         30.4358, 40.6940),
  ('Samsun',          36.33,   41.2867),
  ('Siirt',           41.9500, 37.9333),
  ('Sinop',           35.1531, 42.0231),
  ('Sivas',           37.0179, 39.7477),
  ('Şanlıurfa',       38.7969, 37.1591),
  ('Şırnak',          42.4918, 37.4187),
  ('Tekirdağ',        27.5117, 40.9781),
  ('Tokat',           36.55,   40.3167),
  ('Trabzon',         39.7178, 41.0015),
  ('Tunceli',         39.5401, 39.1079),
  ('Uşak',            29.4082, 38.6823),
  ('Van',             43.4089, 38.4891),
  ('Yalova',          29.2667, 40.6500),
  ('Yozgat',          34.8147, 39.82),
  ('Zonguldak',       31.7987, 41.4564),
  ('Aksaray',         34.0370, 38.3687),
  ('Bartın',          32.3375, 41.6344),
  ('Batman',          41.1351, 37.8812),
  ('Bayburt',         40.2249, 40.2552)
) AS city_coords(city_name, lng, lat)
WHERE veterinarians.city = city_coords.city_name
  AND veterinarians.location IS NULL;

-- ── 5. RPC: get_vets_by_proximity ─────────────────────────────────────────────
-- Returns verified in-person vets ordered by distance from the caller's position.
-- Falls back to rating order for vets without a location set.
--
-- Parameters:
--   user_lat      FLOAT8  — caller latitude
--   user_lng      FLOAT8  — caller longitude
--   max_km        FLOAT8  — maximum search radius (default 500km = nationwide)
--   result_limit  INT     — max rows to return (default 100)
--
-- Usage (from Next.js server component):
--   const { data } = await supabase.rpc('get_vets_by_proximity', {
--     user_lat: 41.0082, user_lng: 28.9784, max_km: 200, result_limit: 50
--   });

CREATE OR REPLACE FUNCTION get_vets_by_proximity(
  user_lat    FLOAT8,
  user_lng    FLOAT8,
  max_km      FLOAT8 DEFAULT 500,
  result_limit INT   DEFAULT 100
)
RETURNS TABLE (
  id                    UUID,
  specialty             TEXT,
  city                  TEXT,
  district              TEXT,
  average_rating        NUMERIC,
  total_reviews         INT,
  bio                   TEXT,
  consultation_fee      INT,
  video_consultation_fee INT,
  offers_in_person      BOOLEAN,
  offers_video          BOOLEAN,
  offers_nobetci        BOOLEAN,
  is_available_today    BOOLEAN,
  distance_km           FLOAT8
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    v.id,
    v.specialty,
    v.city,
    v.district,
    v.average_rating,
    v.total_reviews,
    v.bio,
    v.consultation_fee,
    v.video_consultation_fee,
    v.offers_in_person,
    v.offers_video,
    v.offers_nobetci,
    v.is_available_today,
    CASE
      WHEN v.location IS NOT NULL THEN
        ROUND(
          (ST_Distance(
            v.location,
            ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
          ) / 1000.0)::numeric
        , 1)::FLOAT8
      ELSE NULL
    END AS distance_km
  FROM veterinarians v
  WHERE
    v.is_verified = true
    AND v.offers_in_person = true
    AND (
      v.location IS NULL
      OR ST_DWithin(
           v.location,
           ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
           max_km * 1000
         )
    )
  ORDER BY
    -- Vets with no location coordinates sink to the end, sorted by rating
    CASE WHEN v.location IS NULL THEN 1 ELSE 0 END,
    distance_km ASC NULLS LAST,
    v.average_rating DESC NULLS LAST
  LIMIT result_limit;
$$;

-- ── 6. Diploma storage RLS: allow service_role uploads ────────────────────────
-- The `diplomas` bucket must exist. These policies allow:
--   • service_role to INSERT/UPDATE (for server-side upload via API route)
--   • authenticated users to SELECT their own diploma (for profile display)
--   • Public SELECT for admin review panel
--
-- Run this ONLY if you haven't already configured the diplomas bucket policies.

-- Allow service_role full access (bypass RLS by default — just documenting intent)
-- The service role already bypasses RLS, so no explicit policy needed.

-- Allow authenticated users to read their own diploma
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.policies
    WHERE name = 'diploma_owner_read' AND bucket_id = 'diplomas'
  ) THEN
    INSERT INTO storage.policies (name, bucket_id, operation, definition)
    VALUES (
      'diploma_owner_read',
      'diplomas',
      'SELECT',
      'auth.uid()::text = (storage.foldername(name))[1]'
    );
  END IF;
END $$;
