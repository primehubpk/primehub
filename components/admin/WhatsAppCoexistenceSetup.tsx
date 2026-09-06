'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { CheckCircle2, MessageCircle, ShieldCheck, TriangleAlert } from 'lucide-react';

declare global {
  interface Window {
    FB?: {
      init: (options: Record<string, unknown>) => void;
      login: (
        callback: (response: { authResponse?: { code?: string }; status?: string }) => void,
        options: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

type SessionInfo = {
  wabaId?: string;
  phoneNumberId?: string;
};

export default function WhatsAppCoexistenceSetup() {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID;
  const [sdkReady, setSdkReady] = useState(false);
  const [status, setStatus] = useState('Ready to connect your existing WhatsApp Business App number.');
  const [session, setSession] = useState<SessionInfo>({});

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith('facebook.com')) return;

      let payload: unknown = event.data;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }

      if (!payload || typeof payload !== 'object') return;
      const data = payload as {
        type?: string;
        event?: string;
        data?: { waba_id?: string; phone_number_id?: string };
      };

      if (data.type !== 'WA_EMBEDDED_SIGNUP') return;

      if (data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' || data.event === 'FINISH') {
        setSession({
          wabaId: data.data?.waba_id,
          phoneNumberId: data.data?.phone_number_id,
        });
        setStatus('WhatsApp coexistence onboarding completed in Meta.');
      } else if (data.event) {
        setStatus(`Meta signup status: ${data.event}`);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const initFacebook = () => {
    if (!appId || !window.FB) return;
    window.FB.init({
      appId,
      cookie: true,
      xfbml: false,
      version: 'v25.0',
    });
    setSdkReady(true);
  };

  const connectWhatsApp = () => {
    if (!appId || !configId) {
      setStatus('Meta App ID or Embedded Signup Configuration ID is missing in Vercel environment variables.');
      return;
    }
    if (!window.FB || !sdkReady) {
      setStatus('Meta SDK is still loading. Please try again in a moment.');
      return;
    }

    setStatus('Opening Meta WhatsApp coexistence signup...');
    window.FB.login(
      (response) => {
        if (response.authResponse?.code) {
          setStatus('Meta authorization received. Complete the remaining WhatsApp steps in the popup.');
        } else {
          setStatus('Meta signup was closed or authorization was not completed.');
        }
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      },
    );
  };

  const configured = Boolean(appId && configId);

  return (
    <section className="mx-auto max-w-4xl p-4 sm:p-6">
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="afterInteractive"
        onLoad={initFacebook}
      />

      <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-[#25D366]/10 p-3 text-[#128C7E]">
            <MessageCircle size={26} />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#14140F]">WhatsApp Business Coexistence</h2>
            <p className="mt-1 text-sm text-black/60">
              Connect the existing PrimeHub customer WhatsApp Business number to Cloud API while keeping the WhatsApp Business App available.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-[#F4F4F1] p-4">
            <div className="flex items-center gap-2 text-sm font-black"><ShieldCheck size={17}/> Existing number</div>
            <p className="mt-1 text-xs text-black/55">Use the number customers already message. Do not use normal migration from this button.</p>
          </div>
          <div className="rounded-2xl bg-[#F4F4F1] p-4">
            <div className="flex items-center gap-2 text-sm font-black"><CheckCircle2 size={17}/> Coexistence mode</div>
            <p className="mt-1 text-xs text-black/55">The Meta popup is launched with WhatsApp Business App onboarding enabled.</p>
          </div>
        </div>

        {!configured && (
          <div className="mt-5 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 shrink-0" size={18}/>
            <div>
              <p className="font-black">One Meta setting is still required before the button can work.</p>
              <p className="mt-1 text-xs">Add NEXT_PUBLIC_META_APP_ID and NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID in Vercel. Do not put App Secret or access tokens in public variables.</p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={connectWhatsApp}
          className="mt-5 w-full rounded-2xl bg-[#25D366] px-5 py-3.5 text-sm font-black text-[#0B2517] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Connect Existing WhatsApp Business Number
        </button>

        <p className="mt-3 rounded-xl bg-black/[0.035] px-3 py-2 text-xs font-semibold text-black/60">{status}</p>

        {(session.wabaId || session.phoneNumberId) && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
            <p className="font-black">Meta connection completed.</p>
            {session.wabaId && <p className="mt-1 break-all">WABA ID: {session.wabaId}</p>}
            {session.phoneNumberId && <p className="mt-1 break-all">Phone Number ID: {session.phoneNumberId}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
