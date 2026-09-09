'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { Settings, BucketUpdate, BucketMove } from './SiteSettingsTypes';

export default function WeeklyDealsSettings({
  settings,
  updateBucket,
  addBucket,
  removeBucket,
  moveBucket,
}: {
  settings: Settings;
  updateBucket: BucketUpdate;
  addBucket: () => void;
  removeBucket: (i: number) => void;
  moveBucket: BucketMove;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold">Glowing Price Buckets</p>
          <p className="text-[11px] text-black/45">Title, max price, icon, glow accent, order and visibility.</p>
        </div>
        <button type="button" onClick={addBucket} className="inline-flex items-center gap-1 rounded-full bg-[#14140F] px-3 py-2 text-[10px] font-black text-white"><Plus size={13}/>Add</button>
      </div>
      <div className="space-y-2">
        {settings.priceBuckets.map((bucket, index) => (
          <div key={bucket.id} className="grid gap-2 rounded-xl bg-[#F4F4F1] p-3 sm:grid-cols-[1.2fr_100px_1.4fr_90px_72px_80px]">
            <input value={bucket.title} onChange={(event) => updateBucket(index, { title: event.target.value })} placeholder="Title" className="rounded-lg bg-white px-3 py-2 text-xs"/>
            <input type="number" value={bucket.amount ?? ''} onChange={(event) => updateBucket(index, { amount: Number(event.target.value) })} placeholder="Max price" className="rounded-lg bg-white px-3 py-2 text-xs"/>
            <input value={bucket.iconUrl} onChange={(event) => updateBucket(index, { iconUrl: event.target.value })} placeholder="Icon image URL" className="rounded-lg bg-white px-3 py-2 text-xs"/>
            <input value={bucket.accent} onChange={(event) => updateBucket(index, { accent: event.target.value })} placeholder="#FFB020" className="rounded-lg bg-white px-3 py-2 text-xs"/>
            <label className="flex items-center gap-2 rounded-lg bg-white px-2 py-2 text-xs font-bold"><input type="checkbox" checked={bucket.active} onChange={(event) => updateBucket(index, { active: event.target.checked })}/>Show</label>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => moveBucket(index, -1)} disabled={index === 0} className="rounded-lg bg-white p-2 disabled:opacity-30"><ArrowUp size={13}/></button>
              <button type="button" onClick={() => moveBucket(index, 1)} disabled={index === settings.priceBuckets.length - 1} className="rounded-lg bg-white p-2 disabled:opacity-30"><ArrowDown size={13}/></button>
              <button type="button" onClick={() => removeBucket(index)} className="rounded-lg bg-white p-2 text-[#E1352B]"><Trash2 size={13}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
