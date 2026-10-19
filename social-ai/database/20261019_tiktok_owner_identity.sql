-- TikTok identity verification (read-only) for the owner's already-paired Android.
-- NO provider credentials/cookies are saved in this version. RLS denies all table reads.
CREATE TABLE IF NOT EXISTS public.ph_social_tiktok_identities (
  device_id uuid PRIMARY KEY REFERENCES public.ph_social_pairing_devices(device_id) ON DELETE CASCADE,
  open_id text NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  verified_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ph_social_tiktok_identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ph_social_tiktok_identities FROM public,anon,authenticated;
CREATE TABLE IF NOT EXISTS public.ph_social_oauth_private_proofs (
  key_name text PRIMARY KEY,
  secret_sha256 text NOT NULL
);
ALTER TABLE public.ph_social_oauth_private_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ph_social_oauth_private_proofs FROM public,anon,authenticated;
-- The secret hash is installed separately through secure deployment, never committed here.

CREATE OR REPLACE FUNCTION public.ph_social_tiktok_owner_status(p_device_id uuid,p_device_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,extensions
AS $$
DECLARE p record;
BEGIN
  IF p_device_id IS NULL OR p_device_token IS NULL OR p_device_token !~ '^[a-f0-9]{64}$' THEN
    RETURN jsonb_build_object('authorized',false);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ph_social_pairing_devices d WHERE d.device_id=p_device_id AND d.paired_at IS NOT NULL
     AND d.device_hash=encode(extensions.digest(p_device_token,'sha256'),'hex')) THEN
    RETURN jsonb_build_object('authorized',false);
  END IF;
  SELECT display_name,open_id,avatar_url,verified_at INTO p
    FROM public.ph_social_tiktok_identities WHERE device_id=p_device_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('authorized',true,'connected',false);
  END IF;
  RETURN jsonb_build_object('authorized',true,'connected',true,'display_name',p.display_name,
    'avatar_url',p.avatar_url,'verified_at',p.verified_at,
    'verified_identity_only',true,'can_publish',false);
END $$;

CREATE OR REPLACE FUNCTION public.ph_social_tiktok_owner_save(
  p_device_id uuid,p_device_token text,p_open_id text,p_display_name text,p_avatar_url text,p_server_proof text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,extensions
AS $$
BEGIN
  IF p_device_id IS NULL OR p_device_token !~ '^[a-f0-9]{64}$'
    OR p_server_proof IS NULL OR length(p_server_proof)<40 OR length(p_server_proof)>200
    OR p_open_id IS NULL OR length(p_open_id) NOT BETWEEN 1 AND 180
    OR p_display_name IS NULL OR length(p_display_name) NOT BETWEEN 1 AND 150
    OR p_avatar_url IS NULL OR length(p_avatar_url)>1024
    OR (p_avatar_url <> '' AND p_avatar_url !~ '^https://') THEN
     RETURN jsonb_build_object('saved',false);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ph_social_oauth_private_proofs
      WHERE key_name='tiktok_identity_server_proof'
      AND secret_sha256=encode(extensions.digest(p_server_proof,'sha256'),'hex')) THEN
    RETURN jsonb_build_object('saved',false);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ph_social_pairing_devices d WHERE d.device_id=p_device_id AND d.paired_at IS NOT NULL
     AND d.device_hash=encode(extensions.digest(p_device_token,'sha256'),'hex')) THEN
    RETURN jsonb_build_object('saved',false);
  END IF;
  INSERT INTO public.ph_social_tiktok_identities(device_id,open_id,display_name,avatar_url,verified_at)
    VALUES (p_device_id,p_open_id,p_display_name,p_avatar_url,now())
    ON CONFLICT (device_id) DO UPDATE
      SET open_id=excluded.open_id,display_name=excluded.display_name,
          avatar_url=excluded.avatar_url,verified_at=excluded.verified_at;
  RETURN jsonb_build_object('saved',true);
END $$;

CREATE OR REPLACE FUNCTION public.ph_social_tiktok_owner_disconnect(p_device_id uuid,p_device_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,extensions
AS $$
DECLARE deleted_id uuid;
BEGIN
  IF p_device_id IS NULL OR p_device_token !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('removed',false); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ph_social_pairing_devices d WHERE d.device_id=p_device_id AND d.paired_at IS NOT NULL
     AND d.device_hash=encode(extensions.digest(p_device_token,'sha256'),'hex')) THEN
    RETURN jsonb_build_object('removed',false);
  END IF;
  DELETE FROM public.ph_social_tiktok_identities WHERE device_id=p_device_id RETURNING device_id INTO deleted_id;
  RETURN jsonb_build_object('removed',true);
END $$;
REVOKE ALL ON FUNCTION public.ph_social_tiktok_owner_status(uuid,text) FROM public;
REVOKE ALL ON FUNCTION public.ph_social_tiktok_owner_save(uuid,text,text,text,text,text) FROM public;
REVOKE ALL ON FUNCTION public.ph_social_tiktok_owner_disconnect(uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.ph_social_tiktok_owner_status(uuid,text) TO anon;
GRANT EXECUTE ON FUNCTION public.ph_social_tiktok_owner_save(uuid,text,text,text,text,text) TO anon;
GRANT EXECUTE ON FUNCTION public.ph_social_tiktok_owner_disconnect(uuid,text) TO anon;
