'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight, Gift, ShoppingBag } from 'lucide-react';
import { useSettings } from '@/lib/useSettings';
import { bogoWindow, isBogoProduct, resolveBogoSettings } from '@/lib/bogoOffers';
import { useCartStore, type CartItem } from '@/lib/cartStore';
import { getVerifiedDealProduct } from '@/lib/verifiedDealProduct';
import ProductShareButton from '@/components/ProductShareButton';
import { useVisitShuffled } from '@/lib/useVisitShuffled';
import { normalizeImageUrl } from '@/lib/imageUrl';
import './bogo-deals.css';

const money = (value: number) => 'Rs. ' + value.toLocaleString('en-PK');

const BogoCard = memo(function BogoCard({ product, live }: { product: any; live: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const addItem = useCartStore(state => state.addItem);
  const openVariantModal = useCartStore(state => state.openVariantModal);
  const title = String(product.title).split(' — Buy 1')[0];
  const image = normalizeImageUrl(product.imageUrl || '');
  const stock = product.stock == null || product.stock === '' ? 30 : Number(product.stock);
  const available = live && stock > 0;
  async function add() {
    if (busy || !available) return;
    setBusy(true); setError('');
    try {
      const fresh = await getVerifiedDealProduct(product.id);
      if (!isBogoProduct(fresh) || fresh.active === false || fresh.published === false) throw new Error('This offer is unavailable.');
      if (openVariantModal(fresh, 'cart')) return;
      addItem({ id: fresh.id, productId: fresh.id, name: String(fresh.title), category: String(fresh.category || ''),
        price: Number(fresh.price), originalPrice: Number(fresh.originalPrice || fresh.price),
        image: String(fresh.imageUrl || image), imageUrl: String(fresh.imageUrl || image),
        bogoOffer: fresh.bogoOffer as CartItem['bogoOffer'] });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Please retry.'); }
    finally { setBusy(false); }
  }
  return <article className="bogo-card" data-bogo-id={product.id}>
    <Link href={`/product/${encodeURIComponent(product.id)}`} prefetch={false} className="bogo-card__link">
      <div className="bogo-card__image"><Image src={image} alt={title} fill sizes="(max-width:640px) 46vw, 240px" className="object-contain" quality={78}/><span className="bogo-card__badge"><Gift size={12}/> 1 + 1 FREE</span></div>
      <h3>{title}</h3>
      <strong className="bogo-card__price">{money(Number(product.price))}</strong>
      <p className="bogo-card__terms">1 paid + 1 free {product.bogoOffer?.unitLabel || 'pack'}<br/>Same design{product.hasVariants ? ' & size' : ''}</p>
    </Link>
    <button type="button" disabled={busy || !available} onClick={() => void add()} className="bogo-card__add"><ShoppingBag size={15}/>{busy ? 'Checking…' : !available ? stock <= 0 ? 'Sold out' : 'Offer paused' : product.hasVariants ? 'Choose size · Get 2' : 'Add offer · Get 2'}</button>
    {error ? <p className="bogo-card__error" role="alert">{error}</p> : null}
  </article>;
});

export default function BogoDeals({ products, landing = false }: { products: any[]; landing?: boolean }) {
  const { settings } = useSettings();
  const config = resolveBogoSettings(settings.bogoDealShowcase);
  const pathname = usePathname();
  const [now, setNow] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('');
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now()); tick();
    const timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, []);
  useEffect(() => {
    if (pathname !== (landing ? '/deals/bogo' : '/')) return;
    const reset = () => { if (rail.current) rail.current.scrollLeft = 0; };
    const frame = window.requestAnimationFrame(reset);
    const restore = (event: PageTransitionEvent) => { if (event.persisted) reset(); };
    window.addEventListener('pageshow', restore);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener('pageshow', restore); };
  }, [pathname, landing]);
  const resolvedOffers = useMemo(() => products.filter(product => isBogoProduct(product) && product.active !== false && product.published !== false), [products]);
  const offers = useVisitShuffled(resolvedOffers, landing ? 'bogo-page' : 'bogo-home', landing ? '/deals/bogo' : '/');
  const groups = useMemo(() => [...new Set(offers.map(product => String(product.bogoGroup || 'Other')))], [offers]);
  const filtered = offers.filter(product => (!group || product.bogoGroup === group) &&
    (!search.trim() || String(product.title + ' ' + product.bogoGroup).toLowerCase().includes(search.trim().toLowerCase())));
  const windowState = bogoWindow(config, now ?? 0);
  const live = now !== null && windowState.live;
  const seconds = windowState.remaining;
  const digits = now === null ? ['--', '--', '--'] : [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(value => String(value).padStart(2, '0'));
  if (!config.enabled || !offers.length) return landing ? <section className="bogo-section"><h1>Buy 1 Get 1 Free</h1><p>These offers are currently unavailable. Please check again soon.</p><Link href="/deals">Browse Mega Deals →</Link></section> : null;
  const Heading = landing ? 'h1' : 'h2';
  return <section className={`bogo-section${landing ? ' bogo-section--landing' : ''}`} aria-label="Buy one get one free offers">
    <div className="bogo-hero">
      <Image className="bogo-hero__art" src="/bogo/gift-icon.webp" alt="Two emerald gift boxes with gold ribbons" width={512} height={512} sizes="80px"/>
      <div className="bogo-hero__copy"><Heading>{config.heading}</Heading>
        <span className="bogo-hero__cta">{landing ? 'Choose your favourite design' : 'Explore all offers'} <ArrowRight size={15}/></span>
      </div>
      {!landing ? <Link href="/deals/bogo" prefetch={false} className="bogo-hero__link" aria-label="Shop all Buy 1 Get 1 Free offers"><span className="sr-only">Shop all Buy 1 Get 1 Free offers</span></Link> : null}
      <div className="bogo-hero__tools">
        <div className="bogo-hero__timer"><div><span className="bogo-live-label"><i className={live ? 'bogo-live-dot' : ''}/>{live ? 'LIVE' : now === null ? 'DAILY' : 'PAUSED'}</span><strong role="timer" aria-label={config.autoRenew ? 'Time until the next daily reset' : 'Time remaining'}>{digits.join(':')}</strong></div><p>{config.autoRenew ? 'Daily reset · PKT' : 'Offer time remaining'}</p></div>
        <div className="bogo-hero__actions"><ProductShareButton path="/deals/bogo" title="Buy 1 Get 1 Free" showLabel className="bogo-share-button"/>
          {landing ? <Link className="bogo-home-link" href="/">← Home</Link> : <><button type="button" aria-label="Previous offers" onClick={() => rail.current?.scrollBy({left: -(rail.current.clientWidth + 10), behavior: 'smooth'})}><ArrowLeft size={16}/></button><button type="button" aria-label="Next offers" onClick={() => rail.current?.scrollBy({left: rail.current.clientWidth + 10, behavior: 'smooth'})}><ArrowRight size={16}/></button></>}
        </div>
      </div>
    </div>
    {landing ? <div className="bogo-filters"><label>Find a design<input type="search" placeholder="Search bangles, bracelets…" value={search} onChange={event => setSearch(event.target.value)}/></label><label>Collection<select value={group} onChange={event => setGroup(event.target.value)}><option value="">All collections</option>{groups.map(value => <option key={value}>{value}</option>)}</select></label><span>{filtered.length} offers</span></div> : null}
    <div ref={rail} dir="ltr" className={landing ? 'bogo-grid' : 'bogo-rail'} tabIndex={landing ? undefined : 0} role={landing ? undefined : 'region'} aria-label={landing ? undefined : 'Swipe Buy 1 Get 1 Free offers'}>{filtered.map(product => <BogoCard key={product.id} product={product} live={live}/>)}</div>
    {!filtered.length ? <p className="bogo-empty">No designs match. <button onClick={() => {setSearch('');setGroup('');}}>Clear filters</button></p> : null}
  </section>;
}
