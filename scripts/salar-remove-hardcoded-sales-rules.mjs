import fs from 'node:fs';

const file = 'lib/salar/modelDrivenEngine.ts';
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(before, after, label) {
  if (!source.includes(before)) throw new Error(`${label} target not found`);
  source = source.replace(before, after);
}

replaceOnce(
  "'ADMIN SALESMAN TRAINING — READ THIS BEFORE INTERPRETING THE CUSTOMER. It is live business guidance, not a fixed reply script.',",
  "'ADMIN SALESMAN TRAINING — READ THIS BEFORE INTERPRETING THE CUSTOMER. Treat it as live business meaning, policy and judgement guidance, not as a reply script. Understand the intent behind examples; do not preserve or imitate their wording unless the admin explicitly says exact wording is required.',",
  'first-layer admin guidance',
);

replaceOnce(
  "'ADMIN SALESMAN TRAINING — READ THIS FIRST. It controls shop-specific behaviour and judgement, not fixed reply scripts.',",
  "'ADMIN SALESMAN TRAINING — READ THIS FIRST. It controls shop-specific behaviour, policy and judgement. Treat it semantically, not as customer-facing copy. Understand what the admin wants, then write the reply in your own natural words unless the admin explicitly requires exact wording.',",
  'final-layer admin guidance',
);

replaceOnce(
  "'Use the ORIGINAL customer message and recent conversation for natural wording. Follow Admin Salesman Training first. Speak in the customer’s Roman Urdu, Urdu, English or mixed style. Never copy training examples mechanically.',",
  "'Use the ORIGINAL customer message and recent conversation for natural wording. Follow Admin Salesman Training first. Speak in the customer’s Roman Urdu, Urdu, English or mixed style. Never copy, quote or mechanically paraphrase training examples; convert their meaning into a natural reply in your own words unless exact wording is explicitly required.',",
  'natural wording rule',
);

replaceOnce(
  "'Answer the exact question first and keep simple answers concise. Be warm, respectful, family-shop friendly and naturally light/fun when suitable.',",
  "'Answer the exact question first and keep simple answers concise. Choose tone and phrasing naturally from the customer’s style plus Admin Salesman Training; do not impose a hardcoded sales personality or canned wording.',",
  'tone rule',
);

replaceOnce(
  "'CUSTOM COLOUR RULE: variant rows remain the first stock authority, but merchant-provided variantColors are also valid makeable colour choices even when that colour is not a stock-row variant. For an exact selected product, IMAGE UNDERSTANDING is valid visual evidence about colours actually visible in that product photo. If IMAGE UNDERSTANDING explicitly confirms the customer requested colour is visibly present, answer the customer directly that the shown colour can be used as the reference; do not make them mark it again unless the shade is ambiguous or they want a different colour. If the exact selected design has gallery/colour-reference images and the requested colour is not explicitly named in data or visibly confirmed, DO NOT incorrectly say the design cannot be made in that colour. Show the exact design with display=product_images and ask the customer to select the relevant image, tap Edit, mark/circle the desired colour and send it back. Treat a customer-marked image as the exact colour reference for that order. Never invent an unnamed colour as available before it is marked or otherwise evidenced.',",
  "'IMAGE AND CUSTOMISATION CAPABILITY: live product/variant data remains the authority for stock and named options. IMAGE UNDERSTANDING is valid visual evidence about what is visibly present in an exact selected product photo, and a customer-marked image can be carried as a visual reference. The image editor may be offered when a visual reference is genuinely useful. Whether a visible or marked colour/design can be promised, made, ordered or sold is a business decision: follow Admin Salesman Training and live website/catalogue data rather than any hardcoded assumption. Never invent stock, makeability, price or a promise from pixels alone.',",
  'custom colour business rule',
);

replaceOnce(
  "'When the customer asks which other colours can be made for the same selected design, use availableColors/variantColors first. If gallery colour-reference images exist, show them with product_images so the customer can mark the desired colour. Explain naturally that the same style can be prepared in the chosen shown colour when merchant variantColors supports it.',",
  "'When product/gallery images would materially help the customer compare visible options or provide a reference, you may use display=product_images. Use availableColors/variantColors and IMAGE UNDERSTANDING as evidence only; let Admin Salesman Training decide the business meaning and promise, and phrase the answer naturally in your own words.',",
  'other colour business rule',
);

replaceOnce(
  "'ORDER FLOW FOR SELECTED DESIGNS: remember the customer’s selected designs across short follow-ups. If one design is being discussed while two other designs were already selected, naturally ask whether those remaining two should also be included. When the customer confirms, finalize the selected designs, summarize the bill/order draft, request exactly Rs. 300 advance (not Rs. 500), and collect/save name, contact number, city and complete address. After the customer shares a payment screenshot, acknowledge it only if the image is actually understood as payment proof, keep the final order draft ready, and guide them to use the WhatsApp order button. The WhatsApp order must preserve the selected product images plus the customer-marked colour-reference image URL so the shop can match the exact colour.',",
  "'ORDER/DEALING RULE: do not hardcode an advance amount, payment rule, address fields, order sequence, discount, promise, follow-up script or required customer wording here. Follow Admin Salesman Training and live website/catalogue data for those business decisions. Preserve selected product/image references in conversation context when useful so the model can apply the current admin-defined order flow accurately.',",
  'hardcoded order flow',
);

replaceOnce(
  "'Keep the tone friendly, respectful and lightly playful/pyaar-mohabbat style where natural, without becoming unprofessional or making fake promises.',",
  "'Keep replies natural and truthful. Let Admin Salesman Training control any shop-specific tone, style or selling approach; do not force a hardcoded personality.',",
  'hardcoded tone personality',
);

fs.writeFileSync(file, source);
console.log('Removed hardcoded sales/dealing instructions; admin training now controls business behaviour semantically.');
