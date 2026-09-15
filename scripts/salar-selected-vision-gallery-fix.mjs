import fs from 'node:fs';

function replaceOnce(file, before, after, label) {
  let source = fs.readFileSync(file, 'utf8');
  if (!source.includes(before)) throw new Error(`${label} target not found in ${file}`);
  source = source.replace(before, after);
  fs.writeFileSync(file, source);
}

const engine = 'lib/salar/modelDrivenEngine.ts';
const proxy = 'app/api/salar/image-proxy/route.ts';
const widget = 'components/salar/SalarWidget.tsx';

replaceOnce(
  engine,
`  const urls = images
    .map((value) => safeHttpsUrl(typeof value === 'string' ? value : value?.url))
    .filter(Boolean);
  return [...new Set(urls)].slice(0, 8);
}`,
`  const urls = images
    .map((value) => safeHttpsUrl(typeof value === 'string' ? value : value?.url || value?.imageUrl || value?.src || value?.image))
    .filter(Boolean);
  return [...new Set(urls)].slice(0, 12);
}`,
  'catalogue image extraction',
);

replaceOnce(
  engine,
`async function analyzeImage(image: SalarModelImageInput, message: string) {
  const system = 'Understand this customer image for catalogue retrieval and sales context only. Describe visible product type, design/style, material if clear, colours, pattern and useful distinguishing details. If the customer has drawn a mark/circle/arrow on a product image, explicitly identify the visibly marked colour or area. If it is clearly a payment screenshot, identify it as payment proof and only mention an amount if it is visibly legible. Do not invent brand, price, stock or SKU. Return one compact line.';
  try {
    return await runProviders({
      system,
      history: [],
      user: message ? \`Customer message: \${cleanText(message, 500)}\\nDescribe the image for catalogue search.\` : 'Describe the image for catalogue search.',
      image,
      useVisionModel: true,
      maxTokens: 260,
      temperature: 0.05,
    });
  } catch (error) {
    console.warn('Salar image understanding unavailable', error instanceof Error ? error.message : 'unknown');
    return null;
  }
}`,
`async function analyzeImage(image: SalarModelImageInput, message: string) {
  const system = 'Understand this customer image for catalogue retrieval and sales context only. Describe visible product type, design/style, material if clear, colours, pattern and useful distinguishing details. If the customer asks whether a colour is present, explicitly say whether that requested colour is visibly present in the image. If the customer has drawn a mark/circle/arrow on a product image, explicitly identify the visibly marked colour or area. If it is clearly a payment screenshot, identify it as payment proof and only mention an amount if it is visibly legible. Do not invent brand, price, stock or SKU. Return one compact line.';
  try {
    return await runProviders({
      system,
      history: [],
      user: message ? \`Customer message: \${cleanText(message, 500)}\\nInspect the image carefully and answer the visible-colour/design question for sales context.\` : 'Describe the image for catalogue search.',
      image,
      useVisionModel: true,
      maxTokens: 260,
      temperature: 0.05,
    });
  } catch (error) {
    console.warn('Salar image understanding unavailable', error instanceof Error ? error.message : 'unknown');
    return null;
  }
}

function asksAboutVisibleProductImage(message: string) {
  return /(colou?r|rang|blue|red|green|pink|black|white|gold(?:en)?|silver|orange|yellow|purple|maroon|mehroon|brown|grey|gray|navy|sky|turquoise|mint|pic|photo|image|tasveer|design|style|isme|is mein|iss mein|mil jay|mil ja|available)/i.test(message);
}

function imageMimeType(value: string) {
  const contentType = cleanText(value, 120).toLowerCase().split(';')[0];
  return contentType.startsWith('image/') ? contentType : '';
}

async function catalogueReferenceVision(catalogue: SalarCatalogue, exactProductIds: string[], message: string) {
  if (!exactProductIds.length || !asksAboutVisibleProductImage(message)) return null;
  const exactIds = new Set(exactProductIds);
  const exactProducts = catalogue.products.filter((product: any) => exactIds.has(cleanText(product?.id, 200)));
  for (const product of exactProducts) {
    for (const imageUrl of productImageUrls(product).slice(0, 4)) {
      try {
        const response = await fetch(imageUrl, {
          cache: 'no-store',
          headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8', 'User-Agent': 'PrimeHubMall-Salar/1.0' },
          signal: AbortSignal.timeout(7000),
        });
        if (!response.ok) continue;
        const mimeType = imageMimeType(response.headers.get('content-type') || '');
        if (!mimeType) continue;
        const declared = Number(response.headers.get('content-length') || 0);
        if (Number.isFinite(declared) && declared > 4 * 1024 * 1024) continue;
        const bytes = await response.arrayBuffer();
        if (!bytes.byteLength || bytes.byteLength > 4 * 1024 * 1024) continue;
        const vision = await analyzeImage({ mimeType, base64: Buffer.from(bytes).toString('base64') }, message);
        if (vision) return vision;
      } catch (error) {
        console.warn('Salar selected catalogue image could not be inspected; trying next image.', error instanceof Error ? error.message : 'unknown');
      }
    }
  }
  return null;
}`,
  'selected image vision helper',
);

replaceOnce(
  engine,
`    'CUSTOM COLOUR RULE: variant rows remain the first stock authority, but merchant-provided variantColors are also valid makeable colour choices even when that colour is not a stock-row variant. If the exact selected design has gallery/colour-reference images and the requested colour is not explicitly named in data, DO NOT incorrectly say the design cannot be made in that colour. Show the exact design with display=product_images and ask the customer to select the relevant image, tap Edit, mark/circle the desired colour and send it back. Treat a customer-marked image as the exact colour reference for that order. Never invent an unnamed colour as available before it is marked or otherwise evidenced.',`,
`    'CUSTOM COLOUR RULE: variant rows remain the first stock authority, but merchant-provided variantColors are also valid makeable colour choices even when that colour is not a stock-row variant. For an exact selected product, IMAGE UNDERSTANDING is valid visual evidence about colours actually visible in that product photo. If IMAGE UNDERSTANDING explicitly confirms the customer requested colour is visibly present, answer the customer directly that the shown colour can be used as the reference; do not make them mark it again unless the shade is ambiguous or they want a different colour. If the exact selected design has gallery/colour-reference images and the requested colour is not explicitly named in data or visibly confirmed, DO NOT incorrectly say the design cannot be made in that colour. Show the exact design with display=product_images and ask the customer to select the relevant image, tap Edit, mark/circle the desired colour and send it back. Treat a customer-marked image as the exact colour reference for that order. Never invent an unnamed colour as available before it is marked or otherwise evidenced.',`,
  'custom colour final rule',
);

replaceOnce(
  engine,
`  const exactProductIds = Array.isArray(input.exactProductIds)
    ? input.exactProductIds.map((id) => cleanText(id, 200)).filter(Boolean).slice(0, 40)
    : [];
  const vision = input.image ? await analyzeImage(input.image, message) : null;

  const understood = await interpretCustomer({
    message: message || 'Customer shared a product image and wants help.',
    history,
    imageDescription: vision?.text,
    adminInstructions: state.instructions,
  });`,
`  const exactProductIds = Array.isArray(input.exactProductIds)
    ? input.exactProductIds.map((id) => cleanText(id, 200)).filter(Boolean).slice(0, 40)
    : [];
  const uploadedVision = input.image ? await analyzeImage(input.image, message) : null;
  const selectedProductVision = !input.image
    ? await catalogueReferenceVision(state.catalogue, exactProductIds, message)
    : null;
  const vision = uploadedVision || selectedProductVision;

  const understood = await interpretCustomer({
    message: message || 'Customer shared a product image and wants help.',
    history,
    imageDescription: vision?.text,
    adminInstructions: state.instructions,
  });`,
  'selected product vision wiring',
);

replaceOnce(
  proxy,
`  return values.map((value: any) => safeHttpsUrl(typeof value === 'string' ? value : value?.url)).filter(Boolean);`,
`  return values.map((value: any) => safeHttpsUrl(typeof value === 'string' ? value : value?.url || value?.imageUrl || value?.src || value?.image)).filter(Boolean);`,
  'proxy catalogue image extraction',
);

replaceOnce(
  proxy,
`    const response = await fetch(requested, { cache: 'no-store', signal: AbortSignal.timeout(9000) });`,
`    const response = await fetch(requested, {
      cache: 'no-store',
      headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8', 'User-Agent': 'PrimeHubMall-Salar/1.0' },
      signal: AbortSignal.timeout(9000),
    });`,
  'proxy fetch headers',
);

replaceOnce(
  widget,
`function messageImage(message: ChatMessage) {
  return message.imagePreview || message.imageUrl || '';
}

function groupedImageProducts(products: ProductCard[]) {`,
`function messageImage(message: ChatMessage) {
  return message.imagePreview || message.imageUrl || '';
}

function proxiedCatalogueImage(url: string) {
  return \`/api/salar/image-proxy?url=\${encodeURIComponent(url)}\`;
}

function SalarCatalogueImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [retryWithProxy, setRetryWithProxy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setRetryWithProxy(false);
    setFailed(false);
  }, [src]);

  if (failed) return <div className={\`\${className} flex items-center justify-center bg-[#F4F4F1] px-2 text-center text-[9px] font-black text-black/35\`}>Image loading...</div>;

  return (
    <img
      src={retryWithProxy ? proxiedCatalogueImage(src) : src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => {
        if (!retryWithProxy) setRetryWithProxy(true);
        else setFailed(true);
      }}
    />
  );
}

function groupedImageProducts(products: ProductCard[]) {`,
  'gallery image retry component',
);

replaceOnce(
  widget,
`                                    <img src={product.imageUrl} alt={product.title || 'Product'} className="h-full w-full object-cover"/>`,
`                                    <SalarCatalogueImage src={String(product.imageUrl || '')} alt={product.title || 'Product'} className="h-full w-full object-cover"/>`,
  'product image gallery retry',
);

fs.rmSync('scripts/salar-selected-vision-gallery-fix.mjs', { force: true });
fs.rmSync('.github/workflows/salar-selected-vision-gallery-fix.yml', { force: true });
console.log('Salar selected-image vision and gallery fix applied.');
