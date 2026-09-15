import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function write(file, content) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function replaceOnce(content, search, replacement, label) {
  const index = content.indexOf(search);
  if (index < 0) throw new Error(`Patch target not found: ${label}`);
  if (content.indexOf(search, index + search.length) >= 0) {
    console.warn(`Patch target appears more than once; replacing first only: ${label}`);
  }
  return content.slice(0, index) + replacement + content.slice(index + search.length);
}

function replaceRegex(content, regex, replacement, label) {
  if (!regex.test(content)) throw new Error(`Patch regex not found: ${label}`);
  regex.lastIndex = 0;
  return content.replace(regex, replacement);
}

// --- SalarWidget -----------------------------------------------------------
{
  const file = 'components/salar/SalarWidget.tsx';
  let s = read(file);

  s = replaceOnce(
    s,
    "import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';",
    "import { FormEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';",
    'react pointer event import',
  );
  s = replaceOnce(
    s,
    "import { Bot, Check, Forward, ImagePlus, Maximize2, Menu, Minus, Minimize2, Plus, Send, ShoppingCart, X } from 'lucide-react';",
    "import { Bot, Check, Forward, ImagePlus, Maximize2, Menu, Minus, Minimize2, Pencil, Plus, RotateCcw, Send, ShoppingCart, X, ZoomIn, ZoomOut } from 'lucide-react';",
    'lucide editor imports',
  );

  s = replaceOnce(
    s,
    `type ProductCard = {\n  id: string;\n  title: string;\n  path: string;\n  imageUrl?: string;\n  price?: number;\n  originalPrice?: number;\n  stock?: number;\n  category?: string;\n};`,
    `type ProductCard = {\n  id: string;\n  title: string;\n  path: string;\n  imageUrl?: string;\n  imageUrls?: string[];\n  variantColors?: Array<{ name: string; imageUrl?: string }>;\n  price?: number;\n  originalPrice?: number;\n  stock?: number;\n  category?: string;\n};`,
    'ProductCard gallery fields',
  );

  s = replaceOnce(
    s,
    "  const [orderId, setOrderId] = useState('');\n  const fileRef = useRef<HTMLInputElement | null>(null);",
    "  const [orderId, setOrderId] = useState('');\n  const [imageEditor, setImageEditor] = useState<{ product: ProductCard; sourceUrl: string } | null>(null);\n  const [editorZoom, setEditorZoom] = useState(1);\n  const [editorReady, setEditorReady] = useState(false);\n  const [editorError, setEditorError] = useState('');\n  const [editorNonce, setEditorNonce] = useState(0);\n  const fileRef = useRef<HTMLInputElement | null>(null);",
    'editor state',
  );

  s = replaceOnce(
    s,
    "  const endRef = useRef<HTMLDivElement | null>(null);",
    "  const endRef = useRef<HTMLDivElement | null>(null);\n  const editorCanvasRef = useRef<HTMLCanvasElement | null>(null);\n  const editorDrawingRef = useRef(false);",
    'editor refs',
  );

  s = replaceOnce(
    s,
    "  if (pathname?.startsWith('/admin')) return null;",
    `  useEffect(() => {\n    if (!imageEditor) return;\n    const canvas = editorCanvasRef.current;\n    if (!canvas) return;\n    setEditorReady(false);\n    setEditorError('');\n    const image = new Image();\n    image.onload = () => {\n      const maxSide = 1200;\n      const naturalWidth = Math.max(1, image.naturalWidth || image.width);\n      const naturalHeight = Math.max(1, image.naturalHeight || image.height);\n      const ratio = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight));\n      canvas.width = Math.max(1, Math.round(naturalWidth * ratio));\n      canvas.height = Math.max(1, Math.round(naturalHeight * ratio));\n      const context2d = canvas.getContext('2d');\n      if (!context2d) {\n        setEditorError('Image editor start nahi ho saka.');\n        return;\n      }\n      context2d.clearRect(0, 0, canvas.width, canvas.height);\n      context2d.drawImage(image, 0, 0, canvas.width, canvas.height);\n      setEditorReady(true);\n    };\n    image.onerror = () => setEditorError('Image edit ke liye load nahi ho saki. Dobara try karein.');\n    image.src = \`/api/salar/image-proxy?url=\${encodeURIComponent(imageEditor.sourceUrl)}&v=\${editorNonce}\`;\n    return () => { image.src = ''; };\n  }, [imageEditor, editorNonce]);\n\n  if (pathname?.startsWith('/admin')) return null;`,
    'editor image effect',
  );

  s = replaceOnce(
    s,
    "  async function quoteOrder(items: OrderItem[]) {",
    `  function openImageEditor(product: ProductCard) {\n    if (!product.imageUrl) return;\n    setSelectedProducts((current) => current.some((item) => item.id === product.id) ? current : [...current, product].slice(0, 30));\n    setImageEditor({ product, sourceUrl: product.imageUrl });\n    setEditorZoom(1);\n    setEditorReady(false);\n    setEditorError('');\n    setEditorNonce((value) => value + 1);\n  }\n\n  function editorPoint(event: ReactPointerEvent<HTMLCanvasElement>) {\n    const canvas = editorCanvasRef.current;\n    if (!canvas) return null;\n    const rect = canvas.getBoundingClientRect();\n    if (!rect.width || !rect.height) return null;\n    return {\n      x: (event.clientX - rect.left) * (canvas.width / rect.width),\n      y: (event.clientY - rect.top) * (canvas.height / rect.height),\n    };\n  }\n\n  function startEditorMark(event: ReactPointerEvent<HTMLCanvasElement>) {\n    if (!editorReady) return;\n    const canvas = editorCanvasRef.current;\n    const point = editorPoint(event);\n    const context2d = canvas?.getContext('2d');\n    if (!canvas || !point || !context2d) return;\n    editorDrawingRef.current = true;\n    canvas.setPointerCapture?.(event.pointerId);\n    context2d.beginPath();\n    context2d.moveTo(point.x, point.y);\n    context2d.lineCap = 'round';\n    context2d.lineJoin = 'round';\n    context2d.strokeStyle = '#E1352B';\n    context2d.lineWidth = Math.max(7, Math.round(canvas.width / 95));\n  }\n\n  function moveEditorMark(event: ReactPointerEvent<HTMLCanvasElement>) {\n    if (!editorDrawingRef.current) return;\n    const canvas = editorCanvasRef.current;\n    const point = editorPoint(event);\n    const context2d = canvas?.getContext('2d');\n    if (!point || !context2d) return;\n    context2d.lineTo(point.x, point.y);\n    context2d.stroke();\n  }\n\n  function stopEditorMark(event?: ReactPointerEvent<HTMLCanvasElement>) {\n    const canvas = editorCanvasRef.current;\n    if (event && canvas?.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);\n    editorDrawingRef.current = false;\n  }\n\n  async function sendMarkedImage() {\n    const canvas = editorCanvasRef.current;\n    const editor = imageEditor;\n    if (!canvas || !editor || !editorReady || sending) return;\n    setEditorError('');\n    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));\n    if (!blob) return setEditorError('Marked image save nahi ho saki. Dobara try karein.');\n    const file = new File([blob], \`salar-colour-reference-\${Date.now()}.jpg\`, { type: 'image/jpeg' });\n    const preview = canvas.toDataURL('image/jpeg', 0.9);\n    const product = { ...editor.product, imageUrl: editor.sourceUrl };\n    setImageEditor(null);\n    await sendMessage('Is marked image mein jis colour par maine nishan lagaya hai woh chahiye. Is photo ko mere order ka exact colour reference save karein.', file, preview, [product]);\n  }\n\n  async function quoteOrder(items: OrderItem[]) {`,
    'editor functions',
  );

  s = replaceRegex(
    s,
    /  async function whatsappOrder\(orderNumber = orderId, quote = orderQuote\) \{[\s\S]*?\n  \}\n\n  async function placeChatOrder/,
    `  async function whatsappOrder(orderNumber = orderId, quote = orderQuote) {\n    if (!orderNumber) return;\n    const number = await adminWhatsAppNumber();\n    if (!number) return setOrderError('WhatsApp number website settings mein nahi mila.');\n    const quotedItems = (quote?.items || orderItems) as any[];\n    const lines = quotedItems.flatMap((item: any, index: number) => {\n      const local = orderItems.find((candidate) => candidate.id === item.productId || candidate.id === item.id || candidate.title === item.title);\n      const image = String(local?.imageUrl || item.image || item.imageUrl || '').trim();\n      return [\n        \`\${index + 1}. \${item.title || item.name || 'Product'} x \${item.quantity || 1}\`,\n        image ? \`   Product image: \${image}\` : '',\n      ].filter(Boolean);\n    });\n    const customerImages = [...new Set([...messages]\n      .reverse()\n      .filter((message) => message.role === 'user' && message.imageUrl)\n      .map((message) => String(message.imageUrl || '').trim())\n      .filter(Boolean))].slice(0, 4);\n    const markedReference = [...messages].reverse().find((message) => (\n      message.role === 'user'\n      && message.imageUrl\n      && /(marked|nishan|colour reference|color reference|exact colour|exact color)/i.test(message.content || '')\n    ))?.imageUrl || '';\n    const message = [\n      '*PrimeHub Salar Order*',\n      \`Order ID: \${orderNumber}\`,\n      '',\n      ...lines,\n      markedReference ? '' : '',\n      markedReference ? \`*Marked colour reference:* \${markedReference}\` : '',\n      customerImages.length ? '' : '',\n      customerImages.length ? '*Customer image references:*' : '',\n      ...customerImages.map((url, index) => \`\${index + 1}. \${url}\`),\n      '',\n      \`Name: \${orderCustomer.name}\`,\n      \`Phone: \${orderCustomer.phone}\`,\n      \`City: \${orderCustomer.city}\`,\n      \`Address: \${orderCustomer.address}\`,\n      quote?.total != null ? \`Total: Rs. \${Number(quote.total).toLocaleString('en-PK')}\` : '',\n      'Advance requested: Rs. 300',\n    ].filter(Boolean).join('\\n');\n    window.open(\`https://wa.me/\${number}?text=\${encodeURIComponent(message)}\`, '_blank', 'noopener,noreferrer');\n  }\n\n  async function placeChatOrder`,
    'WhatsApp image references',
  );

  s = s.replaceAll('Advance requested: Rs. 500', 'Advance requested: Rs. 300');
  s = s.replaceAll('Advance Rs. 500 · balance after ready-order video', 'Advance Rs. 300 · balance after ready-order video');

  s = replaceOnce(
    s,
    `      const candidatesForOrder = references.length ? references : lastSharedProducts;\n      let currentOrderItems = orderItems;\n      if (orderIntent(message) && !currentOrderItems.length && candidatesForOrder.length) {\n        currentOrderItems = candidatesForOrder.map((product) => ({ ...product, quantity: 1 }));\n        setOrderItems(currentOrderItems);\n        void quoteOrder(currentOrderItems);\n      }\n      if (orderIntent(message) && currentOrderItems.length && customerComplete(mergedCustomer) && !orderId) {\n        void placeChatOrder(false, currentOrderItems, mergedCustomer);\n      }`,
    `      const candidatesForOrder = references.length ? references : lastSharedProducts;\n      const lastAssistant = [...messages].reverse().find((item) => item.role === 'assistant')?.content || '';\n      const simpleYes = /^(?:yes|y|haan|han|haa|hmm yes|ok|okay|theek|thik|ji|g|jee|bilkul|kr do|kar do)[.! ]*$/i.test(message.trim());\n      const confirmsPreviousOrderQuestion = simpleYes && /(order|final|bill|design|baqi|remaining|include|add|3|teen)/i.test(lastAssistant);\n      const shouldDraftOrder = orderIntent(message) || confirmsPreviousOrderQuestion;\n      let currentOrderItems = orderItems;\n      if (shouldDraftOrder && !currentOrderItems.length && candidatesForOrder.length) {\n        currentOrderItems = candidatesForOrder.map((product) => ({ ...product, quantity: 1 }));\n        setOrderItems(currentOrderItems);\n        void quoteOrder(currentOrderItems);\n      }\n      if (orderIntent(message) && currentOrderItems.length && customerComplete(mergedCustomer) && !orderId) {\n        void placeChatOrder(false, currentOrderItems, mergedCustomer);\n      }`,
    'yes confirmation order draft flow',
  );

  s = replaceOnce(
    s,
    "              const imageOnlyProducts = message.displayMode === 'product_images' ? (message.products || []).filter((product) => product.imageUrl) : [];",
    `              const imageOnlyProducts = message.displayMode === 'product_images'\n                ? (message.products || []).flatMap((product) => {\n                    const urls = [...new Set([...(product.imageUrls || []), product.imageUrl].filter(Boolean) as string[])].slice(0, 8);\n                    return urls.map((url) => ({ ...product, imageUrl: url }));\n                  })\n                : [];`,
    'expand gallery images',
  );

  s = s.replace('className="grid grid-cols-5 gap-1.5"', 'className="grid grid-cols-3 gap-2"');

  s = replaceRegex(
    s,
    /\{groupProducts\.map\(\(product\) => \(\n\s*<button key=\{product\.id\} type="button" onClick=\{\(\) => toggleProduct\(product\)\}[\s\S]*?<\/button>\n\s*\)\)\}/,
    `{groupProducts.map((product) => (\n                                <div key={\`\${product.id}-\${product.imageUrl || 'image'}\`} className={\`relative aspect-square overflow-hidden rounded-xl border bg-[#F4F4F1] shadow-sm \${selected(product.id) ? 'border-[#0F6A5F] ring-2 ring-[#0F6A5F]/30' : 'border-black/8'}\`}>\n                                  <button type="button" onClick={() => toggleProduct(product)} className="absolute inset-0 block h-full w-full" aria-label={\`Select \${product.title}\`}>\n                                    <img src={product.imageUrl} alt={product.title || 'Product'} className="h-full w-full object-cover"/>\n                                    {selected(product.id) ? <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#0F6A5F] text-white"><Check size={12}/></span> : null}\n                                  </button>\n                                  {selected(product.id) ? <button type="button" onClick={() => openImageEditor(product)} className="absolute bottom-1.5 left-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-black/78 px-2 py-1 text-[8px] font-black text-white shadow"><Pencil size={10}/>Edit</button> : null}\n                                </div>\n                              ))}`,
    'image grid edit button',
  );

  s = replaceOnce(
    s,
    "                            <div className=\"p-2.5\"><a href={product.path || `/product/${encodeURIComponent(product.id)}`} className=\"line-clamp-2 text-[10px] font-black leading-4 text-[#14140F]\">{product.title}</a>{product.price != null ? <p className=\"mt-1 text-[10px] font-black text-[#E1352B]\">{money(product.price)}</p> : null}</div>",
    "                            <div className=\"p-2.5\"><a href={product.path || `/product/${encodeURIComponent(product.id)}`} className=\"line-clamp-2 text-[10px] font-black leading-4 text-[#14140F]\">{product.title}</a>{product.price != null ? <p className=\"mt-1 text-[10px] font-black text-[#E1352B]\">{money(product.price)}</p> : null}{selected(product.id) && product.imageUrl ? <button type=\"button\" onClick={() => openImageEditor(product)} className=\"mt-2 inline-flex items-center gap-1 rounded-full bg-[#14140F] px-2 py-1 text-[8px] font-black text-white\"><Pencil size={10}/>Edit colour</button> : null}</div>",
    'product card edit button',
  );

  s = replaceOnce(
    s,
    "          <form onSubmit={submit} className=\"shrink-0 border-t border-black/8 bg-white p-3\">",
    `          {imageEditor ? (\n            <div className="absolute inset-0 z-[95] flex flex-col bg-[#11110F]/95 text-white">\n              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-3">\n                <div className="min-w-0"><p className="text-xs font-black">Colour mark karein</p><p className="truncate text-[9px] text-white/60">{imageEditor.product.title}</p></div>\n                <button type="button" onClick={() => setImageEditor(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><X size={17}/></button>\n              </div>\n              <div className="flex-1 overflow-auto p-3">\n                <div className="flex min-h-full items-center justify-center">\n                  <canvas\n                    ref={editorCanvasRef}\n                    onPointerDown={startEditorMark}\n                    onPointerMove={moveEditorMark}\n                    onPointerUp={stopEditorMark}\n                    onPointerCancel={stopEditorMark}\n                    className="h-auto max-w-none touch-none rounded-xl bg-white shadow-2xl"\n                    style={{ width: \`\${Math.round(editorZoom * 100)}%\` }}\n                  />\n                </div>\n              </div>\n              <div className="shrink-0 border-t border-white/10 bg-[#171713] p-3">\n                <p className="mb-2 text-[9px] leading-4 text-white/65">Image ko zoom karein aur jis colour par chahen ungli se nishan/circle laga dein. Salar isi marked photo ko exact colour reference ke taur par save karega.</p>\n                {editorError ? <p className="mb-2 text-[9px] font-bold text-[#FF9D97]">{editorError}</p> : null}\n                <div className="flex items-center gap-2">\n                  <button type="button" onClick={() => setEditorZoom((value) => Math.max(0.75, Number((value - 0.25).toFixed(2))))} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><ZoomOut size={15}/></button>\n                  <button type="button" onClick={() => setEditorZoom((value) => Math.min(2.5, Number((value + 0.25).toFixed(2))))} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><ZoomIn size={15}/></button>\n                  <button type="button" onClick={() => setEditorNonce((value) => value + 1)} className="flex h-9 items-center gap-1 rounded-full bg-white/10 px-3 text-[8px] font-black"><RotateCcw size={13}/>Reset</button>\n                  <button type="button" disabled={!editorReady || sending} onClick={() => void sendMarkedImage()} className="ml-auto rounded-full bg-[#E1352B] px-4 py-2.5 text-[9px] font-black text-white disabled:opacity-40">Send marked image</button>\n                </div>\n              </div>\n            </div>\n          ) : null}\n\n          <form onSubmit={submit} className="shrink-0 border-t border-black/8 bg-white p-3">`,
    'editor modal',
  );

  write(file, s);
}

// --- Chat store: retain product gallery/variant colour references ----------
{
  const file = 'lib/salar/chatStore.ts';
  let s = read(file);

  s = replaceOnce(
    s,
    `export type SalarStoredProduct = {\n  id: string;\n  title: string;\n  path?: string;\n  imageUrl?: string;\n  price?: number;`,
    `export type SalarStoredProduct = {\n  id: string;\n  title: string;\n  path?: string;\n  imageUrl?: string;\n  imageUrls?: string[];\n  variantColors?: Array<{ name: string; imageUrl?: string }>;\n  price?: number;`,
    'stored product gallery type',
  );

  s = replaceOnce(
    s,
    `  return value.slice(0, MAX_PRODUCTS_PER_MESSAGE).map((item: any) => {\n    const imageUrl = safeHttpsUrl(item?.imageUrl);\n    return Object.fromEntries(Object.entries({`,
    `  return value.slice(0, MAX_PRODUCTS_PER_MESSAGE).map((item: any) => {\n    const imageUrl = safeHttpsUrl(item?.imageUrl);\n    const imageUrls = Array.isArray(item?.imageUrls)\n      ? [...new Set(item.imageUrls.map((url: unknown) => safeHttpsUrl(url)).filter(Boolean))].slice(0, 8)\n      : [];\n    const variantColors = Array.isArray(item?.variantColors)\n      ? item.variantColors.slice(0, 30).map((variant: any) => {\n          const name = cleanText(variant?.name ?? variant, 120);\n          const variantImage = safeHttpsUrl(variant?.imageUrl);\n          return name ? { name, ...(variantImage ? { imageUrl: variantImage } : {}) } : null;\n        }).filter(Boolean)\n      : [];\n    return Object.fromEntries(Object.entries({`,
    'normalize gallery data',
  );

  s = replaceOnce(
    s,
    `      imageUrl: imageUrl || undefined,\n      price: finiteNumber(item?.price),`,
    `      imageUrl: imageUrl || undefined,\n      imageUrls: imageUrls.length ? imageUrls : undefined,\n      variantColors: variantColors.length ? variantColors : undefined,\n      price: finiteNumber(item?.price),`,
    'persist gallery data',
  );

  write(file, s);
}

// --- Model-driven Salar: custom-colour data + responsible sales flow -------
{
  const file = 'lib/salar/modelDrivenEngine.ts';
  let s = read(file);

  s = replaceOnce(
    s,
    `type ProductCard = {\n  id: string;\n  title: string;\n  path: string;\n  imageUrl?: string;\n  price?: number;`,
    `type ProductCard = {\n  id: string;\n  title: string;\n  path: string;\n  imageUrl?: string;\n  imageUrls?: string[];\n  variantColors?: Array<{ name: string; imageUrl?: string }>;\n  price?: number;`,
    'engine ProductCard gallery fields',
  );

  s = replaceRegex(
    s,
    /function productImageUrl\(product: any\) \{[\s\S]*?\n\}/,
    `function productImageUrls(product: any) {\n  const images = [\n    ...safeArray(product?.images, 8),\n    ...safeArray(product?.variantColors, 30).map((variant: any) => variant?.imageUrl),\n    product?.imageUrl,\n    product?.image,\n  ];\n  const urls = images\n    .map((value) => safeHttpsUrl(typeof value === 'string' ? value : value?.url))\n    .filter(Boolean);\n  return [...new Set(urls)].slice(0, 8);\n}\n\nfunction productImageUrl(product: any) {\n  return productImageUrls(product)[0] || '';\n}`,
    'gallery URL extractor',
  );

  s = replaceOnce(
    s,
    `  const system = 'Understand this customer product image for catalogue retrieval only. Describe visible product type, design/style, material if clear, colours, pattern and useful distinguishing details. Do not invent brand, price, stock or SKU. Return one compact line.';`,
    `  const system = 'Understand this customer image for catalogue retrieval and sales context only. Describe visible product type, design/style, material if clear, colours, pattern and useful distinguishing details. If the customer has drawn a mark/circle/arrow on a product image, explicitly identify the visibly marked colour or area. If it is clearly a payment screenshot, identify it as payment proof and only mention an amount if it is visibly legible. Do not invent brand, price, stock or SKU. Return one compact line.';`,
    'vision marked image/payment guidance',
  );

  s = replaceOnce(
    s,
    `function productFact(product: any): ProductFact {\n  const availableRows = availableVariantRows(product);\n  const variants = allVariantRows(product).map(variantFact).slice(0, 80);\n  const availableSizes = uniqueText([product?.size, ...availableRows.map((row: any) => row?.size)], 30);\n  const availableColors = uniqueText([product?.color, ...availableRows.map((row: any) => row?.color)], 30);\n  const availableVariants = uniqueText(availableRows.flatMap((row: any) => [row?.label, row?.name, row?.variant, row?.option]), 40);\n  const id = cleanText(product?.id, 200);`,
    `function productFact(product: any): ProductFact {\n  const availableRows = availableVariantRows(product);\n  const variants = allVariantRows(product).map(variantFact).slice(0, 80);\n  const variantColors = safeArray(product?.variantColors, 30).map((variant: any) => {\n    const name = cleanText(variant?.name ?? variant, 120);\n    const imageUrl = safeHttpsUrl(variant?.imageUrl);\n    return name ? { name, ...(imageUrl ? { imageUrl } : {}) } : null;\n  }).filter(Boolean) as Array<{ name: string; imageUrl?: string }>;\n  const galleryImageUrls = productImageUrls(product);\n  const availableSizes = uniqueText([product?.size, ...availableRows.map((row: any) => row?.size)], 30);\n  const availableColors = uniqueText([product?.color, ...availableRows.map((row: any) => row?.color), ...variantColors.map((variant) => variant.name)], 30);\n  const availableVariants = uniqueText(availableRows.flatMap((row: any) => [row?.label, row?.name, row?.variant, row?.option]), 40);\n  const id = cleanText(product?.id, 200);`,
    'product facts variant colours',
  );

  s = replaceOnce(
    s,
    `    imageUrl: productImageUrl(product) || undefined,\n    price: finiteNumber(product?.price),`,
    `    imageUrl: galleryImageUrls[0] || undefined,\n    imageUrls: galleryImageUrls.length ? galleryImageUrls : undefined,\n    variantColors: variantColors.length ? variantColors : undefined,\n    price: finiteNumber(product?.price),`,
    'product facts gallery output',
  );

  s = replaceOnce(
    s,
    `  if (name.includes('color') || name.includes('colour')) {\n    const values = [product?.color, ...rows.map((row: any) => row?.color)];\n    return values.some((item) => normalizedIncludes(item, value));\n  }`,
    `  if (name.includes('color') || name.includes('colour')) {\n    const values = [\n      product?.color,\n      ...rows.map((row: any) => row?.color),\n      ...safeArray(product?.variantColors, 30).map((variant: any) => variant?.name ?? variant),\n    ];\n    return values.some((item) => normalizedIncludes(item, value));\n  }`,
    'variant colour requirement match',
  );

  s = replaceOnce(
    s,
    `    const exactMatching = exactProducts.filter((product) => (\n      productAvailable(product)\n      && interpretation.requirements.every((requirement) => matchesRequirement(product, requirement))\n    ));`,
    `    const exactMatching = exactProducts.filter((product) => {\n      const hasColourReference = productImageUrls(product).length > 1\n        || safeArray(product?.variantColors, 30).some((variant: any) => safeHttpsUrl(variant?.imageUrl));\n      return productAvailable(product)\n        && interpretation.requirements.every((requirement) => {\n          const requirementName = normalizeSearchText(requirement.name);\n          const isColourRequirement = requirementName.includes('color') || requirementName.includes('colour');\n          return isColourRequirement && hasColourReference ? true : matchesRequirement(product, requirement);\n        });\n    });`,
    'exact product custom colour fallback',
  );

  s = replaceOnce(
    s,
    `    availableColors: fact.availableColors,\n    availableVariants: fact.availableVariants,`,
    `    availableColors: fact.availableColors,\n    variantColors: fact.variantColors?.map((variant) => variant.name),\n    galleryImageCount: fact.imageUrls?.length,\n    availableVariants: fact.availableVariants,`,
    'final prompt colour references',
  );

  s = replaceOnce(
    s,
    `    'If a requested variant/size is unavailable for a selected item, say so briefly and offer matching available alternatives. If the customer then broadens the request, follow the current interpretation rather than re-imposing the old design.',`,
    `    'If a requested variant/size is unavailable for a selected item, say so briefly and offer matching available alternatives. If the customer then broadens the request, follow the current interpretation rather than re-imposing the old design.',\n    'CUSTOM COLOUR RULE: variant rows remain the first stock authority, but merchant-provided variantColors are also valid makeable colour choices even when that colour is not a stock-row variant. If the exact selected design has gallery/colour-reference images and the requested colour is not explicitly named in data, DO NOT incorrectly say the design cannot be made in that colour. Show the exact design with display=product_images and ask the customer to select the relevant image, tap Edit, mark/circle the desired colour and send it back. Treat a customer-marked image as the exact colour reference for that order. Never invent an unnamed colour as available before it is marked or otherwise evidenced.',\n    'When the customer asks which other colours can be made for the same selected design, use availableColors/variantColors first. If gallery colour-reference images exist, show them with product_images so the customer can mark the desired colour. Explain naturally that the same style can be prepared in the chosen shown colour when merchant variantColors supports it.',\n    'ORDER FLOW FOR SELECTED DESIGNS: remember the customer’s selected designs across short follow-ups. If one design is being discussed while two other designs were already selected, naturally ask whether those remaining two should also be included. When the customer confirms, finalize the selected designs, summarize the bill/order draft, request exactly Rs. 300 advance (not Rs. 500), and collect/save name, contact number, city and complete address. After the customer shares a payment screenshot, acknowledge it only if the image is actually understood as payment proof, keep the final order draft ready, and guide them to use the WhatsApp order button. The WhatsApp order must preserve the selected product images plus the customer-marked colour-reference image URL so the shop can match the exact colour.',\n    'Keep the tone friendly, respectful and lightly playful/pyaar-mohabbat style where natural, without becoming unprofessional or making fake promises.',`,
    'Salar custom colour/order protocol',
  );

  write(file, s);
}

// --- Safe same-origin image proxy for canvas editing -----------------------
write('app/api/salar/image-proxy/route.ts', `import { NextResponse } from 'next/server';\nimport { getSalarState } from '@/lib/salar/server';\n\nexport const runtime = 'nodejs';\nexport const dynamic = 'force-dynamic';\n\nconst MAX_IMAGE_BYTES = 6 * 1024 * 1024;\n\nfunction safeHttpsUrl(value: unknown) {\n  const raw = String(value || '').trim().slice(0, 1800);\n  if (!raw) return '';\n  try {\n    const url = new URL(raw);\n    if (url.protocol !== 'https:') return '';\n    const host = url.hostname.toLowerCase();\n    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) return '';\n    return url.toString();\n  } catch {\n    return '';\n  }\n}\n\nfunction catalogueImageUrls(product: any) {\n  const values = [\n    ...(Array.isArray(product?.images) ? product.images.slice(0, 12) : []),\n    ...(Array.isArray(product?.variantColors) ? product.variantColors.slice(0, 30).map((variant: any) => variant?.imageUrl) : []),\n    product?.imageUrl,\n    product?.image,\n  ];\n  return values.map((value: any) => safeHttpsUrl(typeof value === 'string' ? value : value?.url)).filter(Boolean);\n}\n\nexport async function GET(request: Request) {\n  try {\n    const requested = safeHttpsUrl(new URL(request.url).searchParams.get('url'));\n    if (!requested) return NextResponse.json({ error: 'Invalid image URL.' }, { status: 400 });\n\n    const state = await getSalarState();\n    const allowed = new Set((state.catalogue?.products || []).flatMap((product: any) => catalogueImageUrls(product)));\n    if (!allowed.has(requested)) return NextResponse.json({ error: 'Image is not in the live Salar catalogue.' }, { status: 404 });\n\n    const response = await fetch(requested, { cache: 'no-store', signal: AbortSignal.timeout(9000) });\n    if (!response.ok) return NextResponse.json({ error: 'Image could not be loaded.' }, { status: 502 });\n    const contentType = String(response.headers.get('content-type') || '').toLowerCase();\n    if (!contentType.startsWith('image/')) return NextResponse.json({ error: 'Remote file is not an image.' }, { status: 415 });\n    const declared = Number(response.headers.get('content-length') || 0);\n    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Image is too large.' }, { status: 413 });\n    const bytes = await response.arrayBuffer();\n    if (bytes.byteLength > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Image is too large.' }, { status: 413 });\n\n    return new NextResponse(bytes, {\n      headers: {\n        'Content-Type': contentType,\n        'Cache-Control': 'private, max-age=300',\n        'X-Content-Type-Options': 'nosniff',\n      },\n    });\n  } catch (error) {\n    console.error('Salar image proxy failed', error);\n    return NextResponse.json({ error: 'Image could not be loaded.' }, { status: 503 });\n  }\n}\n`);

// Remove temporary patch automation from the final product commit.
for (const temporary of [
  'scripts/salar-customer-flow-patch.mjs',
  '.github/workflows/salar-customer-flow-patch.yml',
]) {
  try { fs.rmSync(path.join(root, temporary), { force: true }); } catch {}
}

console.log('Salar customer colour/order patch applied successfully.');
