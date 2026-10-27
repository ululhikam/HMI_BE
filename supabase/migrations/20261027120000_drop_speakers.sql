-- =============================================================================
-- Hapus tabel speakers
-- Narasumber kini melekat langsung pada agenda (events.speaker/speakerRole),
-- sehingga tabel dan endpoint /speakers tidak lagi digunakan.
-- =============================================================================

DROP TABLE IF EXISTS public.speakers CASCADE;
