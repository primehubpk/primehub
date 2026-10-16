export type VideoPlatform='youtube'|'tiktok'|'instagram';
export type WholesaleVideo={id:string;title:string;platform:VideoPlatform;url:string;thumbnailUrl?:string;description?:string;price?:number;active?:boolean};
export function youtubeId(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return '';
    const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
    let id = '';
    if (host === 'youtu.be') id = u.pathname.split('/')[1] || '';
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const segments = u.pathname.split('/').filter(Boolean);
      id = ['shorts', 'live', 'embed', 'v'].includes(segments[0]) ? segments[1] || '' : u.searchParams.get('v') || '';
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
  } catch { return ''; }
}
export function thumbnailOf(video:WholesaleVideo){if(video.thumbnailUrl)return video.thumbnailUrl;const id=video.platform==='youtube'?youtubeId(video.url):'';return id?'https://img.youtube.com/vi/'+id+'/hqdefault.jpg':''}
