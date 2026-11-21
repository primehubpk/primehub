'use client';

import NextImage, { type ImageProps } from 'next/image';
import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEventHandler } from 'react';
import { getGlassContentBox, type GlassContentBox } from '@/lib/glassImagePresentation';

type PaddedProps = ImageProps & { src: string; box: GlassContentBox };

function ReviewedContentImage({ src, alt, box, fill, width, height, className, style, priority, loading, onLoad, onError, onClick, ...other }: PaddedProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const probeRef = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(Boolean(priority || loading === 'eager'));
  const [probeReady, setProbeReady] = useState(false);
  const [loadedSource, setLoadedSource] = useState(src);
  const [paintReady, setPaintReady] = useState(false);
  const clipId = 'glass-content-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');

  useEffect(() => {
    if (visible) return;
    const node = svgRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '800px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (visible && probeRef.current?.complete && probeRef.current.naturalWidth > 0) {
      setLoadedSource(probeRef.current.currentSrc || probeRef.current.src || src);
      setProbeReady(true);
    }
  }, [visible, src]);

  const svgStyle: CSSProperties = fill
    ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...style }
    : { width: width || '100%', height: height || '100%', ...style };
  const attributes = Object.fromEntries(Object.entries(other).filter(([key]) => key.startsWith('data-') || key.startsWith('aria-')));

  return <>
    <svg {...attributes} ref={svgRef} role="img" aria-label={alt}
      data-photo-source={src} data-photo-loaded={paintReady ? 'true' : 'false'}
      data-glass-border-removed="true"
      data-source-view-box={[box.left, box.top, box.width, box.height].join(' ')}
      data-source-size={[box.sourceWidth, box.sourceHeight].join(' ')}
      viewBox={[box.left, box.top, box.width, box.height].join(' ')}
      preserveAspectRatio="xMidYMid meet" className={className} style={svgStyle}
      onClick={onClick as MouseEventHandler<SVGSVGElement> | undefined}>
      <title>{alt}</title>
      <defs><clipPath id={clipId}><rect x={box.left} y={box.top} width={box.width} height={box.height}/></clipPath></defs>
      <image href={probeReady ? loadedSource : undefined} x="0" y="0" width={box.sourceWidth} height={box.sourceHeight}
        preserveAspectRatio="xMidYMid meet" clipPath={`url(#${clipId})`}
        onLoad={() => setPaintReady(true)} onError={() => setPaintReady(false)}/>
    </svg>
    {visible && <img ref={probeRef} src={src} alt="" aria-hidden="true" hidden data-source-probe="true"
      loading="eager" fetchPriority={priority ? 'high' : 'auto'} decoding="async"
      style={{ display: 'none', objectFit: 'contain' }}
      onLoad={event => { setLoadedSource(event.currentTarget.currentSrc || event.currentTarget.src || src); setProbeReady(true); onLoad?.(event); }} onError={onError}/>}
  </>;
}

/** Full originals pass through unchanged. SVG clips ONLY a reviewed duplicated
 * blur-padding rectangle, preserving every available sharp product pixel.
 * No new product details are generated. The normal recovery callback stays on
 * the real image loader; the SVG reuses its already-cached <=100KB object.
 */
export default function StorefrontSourceImage(props: ImageProps) {
  const box = getGlassContentBox(props.src);
  return box && typeof props.src === 'string'
    ? <ReviewedContentImage key={props.src} {...props} src={props.src} box={box}/>
    : <NextImage {...props}/>;
}
