package com.primehubmall.app;

import android.app.Activity;
import android.net.Uri;
import android.provider.Settings;
import android.webkit.WebView;
import com.google.android.play.core.integrity.IntegrityManager;
import com.google.android.play.core.integrity.IntegrityManagerFactory;
import com.google.android.play.core.integrity.IntegrityTokenRequest;
import org.json.JSONObject;
import java.io.InputStream;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Play Store installation proof for optional Rs.100 reseller reward.
 * Activated ONLY by a signed-in user pressing Claim. It does NOT run on
 * app startup, navigation, notification delivery, home, shop, or checkout.
 * No IMEI/serial/MAC/advertising identifier permission or access is used.
 */
public final class PlayBonusManager {
    private static final ExecutorService worker = Executors.newSingleThreadExecutor();
    private static boolean inFlight = false;

    private PlayBonusManager() {}

    public static synchronized void claim(Activity activity, WebView webView, String idToken) {
        if (inFlight) return;
        if (idToken == null || idToken.length() < 100 || idToken.length() > 5000) {
            report(webView, false, "Sign in to your Reseller Club account first.");
            return;
        }
        inFlight = true;
        worker.execute(() -> {
            try {
                String androidId = Settings.Secure.getString(activity.getContentResolver(), Settings.Secure.ANDROID_ID);
                if (androidId == null || !androidId.matches("[0-9a-fA-F]{16}")) throw new Exception("Android device verification unavailable.");
                JSONObject challenge = send(activity, new JSONObject()
                    .put("action", "challenge")
                    .put("idToken", idToken)
                    .put("androidId", androidId));
                String nonce = challenge.optString("nonce", "");
                if (nonce.isEmpty()) throw new Exception("Could not start Play Store verification.");
                IntegrityManager manager = IntegrityManagerFactory.create(activity.getApplicationContext());
                // Classic attestation is requested once when the user claims cash,
                // never repeatedly or in the background.
                manager.requestIntegrityToken(
                    IntegrityTokenRequest.builder().setNonce(nonce).build()
                ).addOnSuccessListener(token -> worker.execute(() -> {
                    try {
                        JSONObject verified = send(activity, new JSONObject()
                            .put("action", "claim")
                            .put("idToken", idToken)
                            .put("androidId", androidId)
                            .put("integrityToken", token.token()));
                        report(webView, true, verified.optString("amount", "100") + " rupees added to your withdrawal balance.");
                    } catch (Exception error) {
                        report(webView, false, error.getMessage());
                    } finally {
                        finish();
                    }
                })).addOnFailureListener(error -> {
                    report(webView, false, "Google Play could not verify this installation. Please try from the Play Store app.");
                    finish();
                });
            } catch (Exception error) {
                report(webView, false, error.getMessage());
                finish();
            }
        });
    }

    private static synchronized void finish() { inFlight = false; }

    private static JSONObject send(Activity activity, JSONObject data) throws Exception {
        HttpURLConnection conn = null;
        try {
            String origin = MainActivity.appOrigin();
            URL url = new URL(origin + "/api/reseller/play-install-bonus");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(20000);
            conn.setDoOutput(true);
            conn.setInstanceFollowRedirects(false);
            conn.setRequestProperty("Content-Type", "application/json");
            byte[] payload = data.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream out = conn.getOutputStream()) { out.write(payload); }
            int code = conn.getResponseCode();
            InputStream stream = code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream();
            StringBuilder response = new StringBuilder();
            if (stream != null) {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null && response.length() < 12000) response.append(line);
                }
            }
            JSONObject json = new JSONObject(response.toString());
            if (code < 200 || code >= 300 || !json.optBoolean("ok", false))
                throw new Exception(json.optString("error", "App bonus is not available."));
            return json;
        } finally { if (conn != null) conn.disconnect(); }
    }

    private static void report(WebView webView, boolean success, String message) {
        if (webView == null) return;
        webView.post(() -> {
            try {
                Uri url = Uri.parse(webView.getUrl());
                String host = url.getHost();
                if (host == null || !"https".equalsIgnoreCase(url.getScheme()) ||
                    !(host.equals("primehubmall.com") || host.equals("www.primehubmall.com") ||
                      (BuildConfig.DEBUG && MainActivity.appOrigin().equals(url.getScheme() + "://" + host)))) return;
                JSONObject payload = new JSONObject().put("success", success)
                    .put("message", message == null ? "Reward unavailable." : message);
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('primehub:play-bonus-result',{detail:" + payload.toString() + "}));",
                    null);
            } catch (Exception ignored) { }
        });
    }
}
