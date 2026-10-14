import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = path => readFileSync(path, 'utf8');

test('Only actual credited Rs100 triggers automatic congratulations; email/password login reused', () => {
  const client = file('components/NativePushIdentity.tsx');
  const signin = file('app/reseller/join/page.tsx');
  const auth = file('lib/resellerAuth.ts');
  const server = file('lib/playInstallBonus.ts');
  assert.ok(client.includes("if (!detail?.success) { requestedUid = ''; return; }"));
  assert.ok(client.includes("if (detail?.alreadyClaimed)"));
  assert.ok(client.includes('if (!currentUid.current) return;'));
  assert.match(client, /primehub:reseller-profile-ready/);
  assert.match(client, /'playBonus'/);
  assert.match(client, /Congratulations!/);
  assert.match(client, /setCongratulations\(true\)/);
  assert.match(client, /Close bonus congratulations/);
  assert.match(client, /View My Wallet/);
  assert.ok(signin.includes('primehub:reseller-profile-ready'));
  assert.ok(auth.includes('signInWithEmailAndPassword'));
  assert.ok(auth.includes('createUserWithEmailAndPassword'));
  assert.ok(!signin.includes('signInWithPopup'));
  assert.ok(server.includes("PLAY_INSTALL_BONUS_ENABLED === 'true'"));
  assert.ok(server.includes('claimPlayInstallBonus('));
  assert.ok(server.includes('getAdminDb'));
});

test('Website WhatsApp is a pending request, not immediate confirmed order', () => {
  const server = file('app/api/orders/route.ts');
  const checkout = file('components/checkout/useCheckout.ts');
  const modal = file('components/WhatsAppOrderModal.tsx');
  assert.ok(server.includes("body?.mode === 'whatsapp_intent'"));
  assert.ok(server.includes("collection('whatsapp_order_intents')"));
  assert.ok(server.includes("status: 'awaiting_confirmation'"));
  assert.ok(server.includes('isRealOrder: false'));
  assert.ok(checkout.includes("mode: 'whatsapp_intent'"));
  assert.ok(checkout.includes("Reference: ${quote.requestId}"));
  assert.ok(checkout.includes('Please send this message to confirm your order.'));
  assert.ok(!modal.includes("addDoc(collection(db, 'orders')"));
  assert.ok(modal.includes("mode: 'whatsapp_intent'"));
  assert.ok(modal.includes('Full delivery address'));
});

test('Admin can review website requests, manually record external WhatsApp chats, with no unauthenticated writes', () => {
  const server = file('app/api/admin/orders/route.ts');
  const admin = file('components/admin/OrdersManager.tsx');
  const manual = file('components/admin/ManualWhatsAppOrderForm.tsx');
  assert.ok(server.includes('authorizedWalletAdmin(request)'));
  assert.ok(server.includes("action === 'confirm-whatsapp'"));
  assert.ok(server.includes("action === 'dismiss-whatsapp'"));
  assert.ok(server.includes("action === 'record-whatsapp'"));
  assert.ok(server.includes("whatsappState: 'admin_confirmed'"));
  assert.ok(server.includes("source: 'whatsapp_manual'"));
  assert.ok(server.includes("orders: [...walletBackup, ...orders]"));
  assert.ok(server.includes('whatsappDrafts'));
  assert.ok(admin.includes('WhatsApp Requests'));
  assert.ok(admin.includes('NOT YET CONFIRMED'));
  assert.ok(admin.includes("reviewWhatsappDraft(order.id, 'confirm-whatsapp')"));
  assert.ok(admin.includes('<ManualWhatsAppOrderForm onSaved={reloadOrders} />'));
  assert.ok(manual.includes('Customer WhatsApp / phone'));
  assert.ok(manual.includes('Product / design name'));
  assert.ok(manual.includes('Full delivery address'));
  assert.ok(manual.includes('Save Confirmed WhatsApp Order'));
});

test('No simulated external WhatsApp message processing or fake sale record', () => {
  const webhook = file('app/api/whatsapp/webhook/route.ts');
  assert.ok(webhook.includes('return NextResponse.json({ received: true }'));
  // Until Meta's authenticated webhook and product parsing are connected,
  // messages sent directly to the phone must be entered/reviewed by admin.
  const manual = file('components/admin/ManualWhatsAppOrderForm.tsx');
  assert.ok(manual.includes('Customer messaged the shop outside the website?'));
});
