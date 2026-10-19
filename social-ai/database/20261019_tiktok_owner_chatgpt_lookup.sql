CREATE OR REPLACE FUNCTION public.ph_social_tiktok_owner_check_by_pair_code(p_pair_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,extensions
AS $$
DECLARE owner_device uuid; p record;
BEGIN
 IF p_pair_code IS NULL OR p_pair_code !~ '^[A-Z2-7]{26}$'
   THEN RETURN jsonb_build_object('authorized',false); END IF;
 SELECT device_id INTO owner_device FROM public.ph_social_pairing_devices
  WHERE pair_hash=encode(extensions.digest(p_pair_code,'sha256'),'hex') AND paired_at IS NOT NULL LIMIT 1;
 IF owner_device IS NULL THEN RETURN jsonb_build_object('authorized',false); END IF;
 SELECT display_name,verified_at INTO p FROM public.ph_social_tiktok_identities WHERE device_id=owner_device;
 IF NOT FOUND THEN RETURN jsonb_build_object('authorized',true,'connected',false,
      'can_publish',false,'can_control_app',false); END IF;
 RETURN jsonb_build_object('authorized',true,'connected',true,'display_name',p.display_name,
      'verified_at',p.verified_at,'can_publish',false,'can_control_app',false,
      'verification','TikTok Login Kit basic profile identity only');
END $$;
REVOKE ALL ON FUNCTION public.ph_social_tiktok_owner_check_by_pair_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.ph_social_tiktok_owner_check_by_pair_code(text) TO anon;
