'use client';

import { useEffect, useState } from 'react';

type Creator = {
  creator_nickname?: string;
  creator_username?: string;
  privacy_level_options?: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
};

export default function TikTokPostingManager() {
  const [pin, setPin] = useState('');
  const [creator, setCreator] = useState<Creator | null>(null);
  const [connected, setConnected] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [privacy, setPrivacy] = useState('');
  const [comment, setComment] = useState(false);
  const [duet, setDuet] = useState(false);
  const [stitch, setStitch] = useState(false);
  const [commercial, setCommercial] = useState(false);
  const [brandOrganic, setBrandOrganic] = useState(false);
  const [brandContent, setBrandContent] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [consent, setConsent] = useState(false);
  const [publishId, setPublishId] = useState('');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const note = new URLSearchParams(window.location.search).get('posting');
    if (note) queueMicrotask(() => setMessage(note));
  }, []);

  async function api(method: string, body?: object) {
    const response = await fetch('/api/admin/tiktok/posting', {
      method, cache: 'no-store', credentials: 'same-origin',
      headers: { 'x-tiktok-posting-pin': pin, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'TikTok request failed.');
    return data;
  }

  async function load() {
    setBusy(true); setMessage('');
    try {
      const result = await api('GET');
      setConnected(result.connected);
      setCreator(result.creator || null);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Connection failed.'); }
    finally { setBusy(false); }
  }

  async function connect() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/tiktok/oauth/start', {
        method: 'POST', headers: { 'x-tiktok-posting-pin': pin }, credentials: 'same-origin', cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Connection failed.');
      window.location.assign(result.url);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Connection failed.'); setBusy(false); }
  }

  async function publish() {
    setBusy(true); setMessage('');
    try {
      const result = await api('POST', {
        action: 'publish', videoUrl, title, privacy, comment, duet, stitch,
        commercial, brandOrganic, brandContent, aiGenerated, consent,
      });
      setPublishId(result.publishId);
      setStatus('TikTok is processing the video. Check status again in a few minutes.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Post failed.'); }
    finally { setBusy(false); }
  }

  async function checkStatus() {
    setBusy(true);
    try {
      const result = await api('POST', { action: 'status', publishId });
      setStatus(JSON.stringify(result.status));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Status failed.'); }
    finally { setBusy(false); }
  }

  async function disconnect() {
    setBusy(true);
    try { await api('DELETE'); setConnected(false); setCreator(null); setMessage('Stored TikTok connection removed.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Disconnect failed.'); }
    finally { setBusy(false); }
  }

  const input = 'mt-1 w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm';
  const button = 'rounded-full bg-[#14140F] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40';
  const validUrl = /^https:\/\/www\.primehubmall\.com\/[^?#]+\.(mp4|mov)(?:\?[^#]*)?$/i.test(videoUrl);
  const durationValid = duration !== null && Number.isFinite(duration) && duration > 0 && duration <= (creator?.max_video_post_duration_sec || 0);
  const canPublish = connected && creator && validUrl && durationValid && title.trim() && privacy === 'SELF_ONLY' && consent && (!commercial || brandOrganic || brandContent) && !brandContent;

  return <section className="mx-auto max-w-4xl px-4 pb-10 sm:px-6">
    <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-black">Sandbox video posting</h2>
      <p className="mt-2 text-xs leading-5 text-black/60">Only me posts during sandbox testing. TikTok public posting requires its separate app review.</p>
      <label className="mt-4 block text-xs font-bold">TikTok posting admin PIN (server setting)</label>
      <input type="password" autoComplete="off" value={pin} onChange={e => setPin(e.target.value)} className={input} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={button} disabled={busy || pin.length < 16} onClick={() => void load()}>Check account</button>
        <button type="button" className={button} disabled={busy || pin.length < 16} onClick={() => void connect()}>Connect TikTok</button>
        {connected && <button type="button" className={button} disabled={busy} onClick={() => void disconnect()}>Disconnect</button>}
      </div>
      {creator && <p className="mt-4 text-sm font-bold">Connected creator: {creator.creator_nickname} (@{creator.creator_username})</p>}
      <p role="status" className="mt-3 text-xs text-[#A52F25]">{message}</p>
    </div>

    {creator && <div className="mt-4 rounded-3xl bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-lg font-black">Preview and post</h3>
      <label className="mt-4 block text-xs font-bold">Video URL on verified PrimeHubMall domain (MP4/MOV)</label>
      <input type="url" value={videoUrl} onChange={e => { setVideoUrl(e.target.value); setDuration(null); }} className={input} placeholder="https://www.primehubmall.com/.../video.mp4" />
      {validUrl && <video key={videoUrl} controls preload="metadata" className="mt-3 max-h-96 w-full rounded-xl bg-black" src={videoUrl}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)} onError={() => setDuration(null)} />}
      {duration !== null && <p className="mt-2 text-xs">Duration: {Math.round(duration)}s / TikTok maximum: {creator.max_video_post_duration_sec}s</p>}
      <label className="mt-4 block text-xs font-bold">Editable caption and hashtags</label>
      <textarea maxLength={2200} value={title} onChange={e => setTitle(e.target.value)} className={input} rows={3} />
      <label className="mt-4 block text-xs font-bold">Privacy (choose manually)</label>
      <select value={privacy} onChange={e => setPrivacy(e.target.value)} className={input}>
        <option value="">Choose privacy</option>
        {(creator.privacy_level_options || []).map(option => <option key={option} value={option} disabled={option !== 'SELF_ONLY'}>{option === 'SELF_ONLY' ? 'Only me (sandbox)' : option + ' (after audit)'}</option>)}
      </select>
      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        {([['comment', comment, setComment, creator.comment_disabled], ['duet', duet, setDuet, creator.duet_disabled], ['stitch', stitch, setStitch, creator.stitch_disabled]] as const).map(([name, value, setter, disabled]) =>
          <label key={name} className="flex items-center gap-2"><input type="checkbox" checked={value} disabled={disabled} onChange={e => setter(e.target.checked)} /> Allow {name}{disabled ? ' (unavailable)' : ''}</label>)}
      </div>
      <label className="mt-4 flex items-center gap-2 text-xs"><input type="checkbox" checked={commercial} onChange={e => setCommercial(e.target.checked)} /> This video promotes a brand, product or service</label>
      {commercial && <div className="mt-2 flex flex-col gap-2 pl-5 text-xs">
        <label><input type="checkbox" checked={brandOrganic} onChange={e => setBrandOrganic(e.target.checked)} /> Your brand (Promotional content)</label>
        <label><input type="checkbox" checked={brandContent} onChange={e => setBrandContent(e.target.checked)} /> Paid partnership (requires public/friends privacy)</label>
      </div>}
      <label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={aiGenerated} onChange={e => setAiGenerated(e.target.checked)} /> AI generated video</label>
      <label className="mt-4 flex items-start gap-2 text-xs"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> <span>I previewed this video and expressly consent to upload it. By posting, I agree to TikTok’s <a className="underline" target="_blank" rel="noreferrer" href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en">Music Usage Confirmation</a>.</span></label>
      <button type="button" className={`mt-4 ${button}`} disabled={busy || !canPublish} onClick={() => void publish()}>Post privately to TikTok</button>
      {!durationValid && validUrl && <p className="mt-2 text-xs text-black/50">Video must load and fit this creator’s duration limit.</p>}
      {publishId && <div className="mt-5 rounded-xl bg-[#F4F4F1] p-4 text-xs"><p>Post ID: {publishId}</p><p className="mt-2 break-all">{status}</p><button type="button" className={`mt-3 ${button}`} disabled={busy} onClick={() => void checkStatus()}>Check TikTok status</button></div>}
    </div>}
  </section>;
}
