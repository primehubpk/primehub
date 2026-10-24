package com.primehubmall.app;

import android.app.Application;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.facebook.FacebookSdk;
import com.facebook.appevents.AppEventsLogger;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Currency;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Product analytics from the trusted storefront main frame only. No customer identity. */
final class MetaAppEvents {
    private static final String TAG = "PrimeHubMeta";
    private static volatile boolean ready;

    @SuppressWarnings("deprecation")
    static void initialize(Application app) {
        if (!BuildConfig.META_EVENTS_CONFIGURED) return;
        try {
            FacebookSdk.setAdvertiserIDCollectionEnabled(false);
            FacebookSdk.setAutoLogAppEventsEnabled(false);
            FacebookSdk.sdkInitialize(app);
            FacebookSdk.setAutoInitEnabled(true);
            AppEventsLogger.activateApp(app);
            ready = true;
        } catch (Exception error) {
            Log.w(TAG, "Meta events unavailable; shopping continues");
        }
    }

    static void attach(Context context, WebView view) {
        if (!ready || !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        Set<String> origins = new HashSet<>(Arrays.asList(
            "https://www.primehubmall.com", "https://primehubmall.com"));
        if (BuildConfig.DEBUG) origins.add(MainActivity.appOrigin());
        try {
            WebViewCompat.addWebMessageListener(view, "PrimeHubMeta", origins,
                (webview, message, origin, isMainFrame, reply) -> {
                    if (!isMainFrame || origin == null || !origins.contains(origin.toString())) return;
                    String raw = message.getData();
                    if (raw == null || raw.length() > 32_768) return;
                    try { log(context, new JSONObject(raw)); }
                    catch (Exception ignored) { /* Analytics never blocks checkout. */ }
                });
        } catch (Exception ignored) { Log.w(TAG, "Meta WebView bridge unavailable"); }
    }

    private static String eventName(String event) {
        switch (event) {
            case "ViewContent": return "fb_mobile_content_view";
            case "AddToCart": return "fb_mobile_add_to_cart";
            case "InitiateCheckout": return "fb_mobile_initiated_checkout";
            case "Purchase": return "fb_mobile_purchase";
            case "Search": return "fb_mobile_search";
            default: return null;
        }
    }

    private static synchronized void log(Context context, JSONObject json) throws Exception {
        String name = eventName(json.optString("event"));
        if (name == null) return;
        String eventId = json.optString("eventId", "");
        boolean purchase = "fb_mobile_purchase".equals(name);
        SharedPreferences preferences = context.getSharedPreferences("primehub_meta_events", Context.MODE_PRIVATE);
        Set<String> seen = new HashSet<>(preferences.getStringSet("purchase_ids", new HashSet<>()));
        double value = json.optDouble("value", Double.NaN);
        if (purchase && (!eventId.matches("order_[0-9a-fA-F-]{36}") || seen.contains(eventId)
            || !Double.isFinite(value) || value < 0)) return;
        Bundle params = new Bundle();
        JSONArray contents = json.optJSONArray("contents");
        JSONArray ids = new JSONArray();
        JSONArray cleanContents = new JSONArray();
        int quantity = 0;
        if (contents != null) for (int i = 0; i < Math.min(contents.length(), 100); i++) {
            JSONObject item = contents.optJSONObject(i);
            if (item == null) continue;
            String id = item.optString("id", "");
            int count = item.optInt("quantity", 1);
            if (!id.matches("[A-Za-z0-9_-]{1,100}") || count < 1 || count > 10000) continue;
            ids.put(id);
            cleanContents.put(new JSONObject().put("id", id).put("quantity", count));
            quantity += count;
        }
        if (ids.length() > 0) {
            params.putString("fb_content_type", "product");
            params.putString("fb_content_id", ids.length() == 1 ? ids.getString(0) : ids.toString());
            params.putString("fb_content", cleanContents.toString());
            params.putInt("fb_num_items", quantity);
        }
        String currency = json.optString("currency", "PKR");
        if (!currency.matches("[A-Z]{3}")) return;
        params.putString("fb_currency", currency);
        if (!eventId.isEmpty() && eventId.length() <= 100) params.putString("event_id", eventId);
        AppEventsLogger logger = AppEventsLogger.newLogger(context);
        if (purchase) {
            logger.logPurchase(BigDecimal.valueOf(value), Currency.getInstance(currency), params);
            // Persist across WebView reloads and app restarts, with bounded storage.
            if (seen.size() >= 128) seen.clear();
            seen.add(eventId);
            preferences.edit().putStringSet("purchase_ids", seen).apply();
        } else if (Double.isFinite(value) && value >= 0) {
            logger.logEvent(name, value, params);
        } else {
            logger.logEvent(name, params);
        }
    }
}
