package com.primehubmall.app;

import android.app.Activity;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.WebView;

import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Optional, low-friction Rs.100 welcome gift for existing email/password
 * accounts in the Google Play-installed PrimeHub Android app.
 *
 * No Play Integrity SDK, no new login, no IMEI, no customer verification page.
 * Server enforces one award per Firebase UID and hashed app-scoped Android ID.
 * Local Play installer detection is a convenience gate, NOT security attestation.
 * Reward action is started ONLY after user signs in, not during app startup.
 */
public final class PlayBonusManager {
    private static final ExecutorService worker = Executors.newSingleThreadExecutor();
    private static boolean inFlight = false;
    private PlayBonusManager() {}

    public static synchronized void claim(Activity activity, WebView webView, String idToken) {
        if (inFlight) return;
        if (idToken == null || idToken.length() < 100 || idToken.length() > 5000) {
            report(webView, false, false, "", "Sign in to PrimeHub first.");
            return;
        }
        inFlight = true;
        worker.execute(() -> {
            try {
                String installer = getInstaller(activity);
                if (!"com.android.vending".equals(installer)) {
                    // APKs sideloaded for QA do not receive a cash award.
                    report(webView, false, false, "", "This welcome gift is for Google Play installations.");
                    return;
                }
                // ANDROID_ID is scoped to the app-signing key, Android user and
                // device on Android 8+. Never read device IMEI/serial/MAC.
                String androidId = Settings.Secure.getString(
                    activity.getContentResolver(), Settings.Secure.ANDROID_ID);
                if (androidId == null || !androidId.matches("[0-9a-fA-F]{16}")) {
                    report(webView, false, false, "", "Device ID unavailable for this install.");
                    return;
                }
                JSONObject result = send(new JSONObject()
                    .put("action", "claim")
                    .put("idToken", idToken)
                    .put("androidId", androidId)
                    .put("installer", installer));
                if (result.optBoolean("credited", false)) {
                    report(webView, true, false, "", "Rs. 100 welcome bonus added to your wallet!");
                } else if (result.optBoolean("alreadyClaimed", false)) {
                    report(webView, false, true, result.optString("reason", "account"),
                        "This one-time welcome gift has already been used.");
                } else {
                    report(webView, false, false, "", "Welcome bonus unavailable.");
                }
            } catch (Exception error) {
                report(webView, false, false, "",
                    error.getMessage() == null ? "Please try again later." : error.getMessage());
            } finally {
                finish();
            }
        });
    }

    private static String getInstaller(Activity activity) {
        try {
            PackageManager packageManager = activity.getPackageManager();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                return packageManager.getInstallSourceInfo(activity.getPackageName()).getInstallingPackageName();
            }
            return packageManager.getInstallerPackageName(activity.getPackageName());
        } catch (Exception ignored) { return ""; }
    }

    private static synchronized void finish() { inFlight = false; }

    private static JSONObject send(JSONObject payload) throws Exception {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(MainActivity.appOrigin() + "/api/reseller/play-install-bonus");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(7000);
            conn.setReadTimeout(10000);
            conn.setDoOutput(true);
            conn.setInstanceFollowRedirects(false);
            conn.setRequestProperty("Content-Type", "application/json");
            byte[] data = payload.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream out = conn.getOutputStream()) { out.write(data); }
            int code = conn.getResponseCode();
            InputStream stream = code >= 200 && code < 300
                ? conn.getInputStream() : conn.getErrorStream();
            StringBuilder body = new StringBuilder();
            if (stream != null) {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null && body.length() < 4096) body.append(line);
                }
            }
            JSONObject json = new JSONObject(body.length() == 0 ? "{}" : body.toString());
            if (code < 200 || code >= 300 || !json.optBoolean("ok", false)) {
                throw new Exception(json.optString("error", "Welcome gift temporarily unavailable."));
            }
            return json;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static void report(WebView webView, boolean credited, boolean alreadyClaimed,
                               String reason, String message) {
        if (webView == null) return;
        webView.post(() -> {
            try {
                Uri uri = Uri.parse(webView.getUrl());
                String host = uri.getHost();
                if (host == null || !"https".equalsIgnoreCase(uri.getScheme()) ||
                    !(host.equals("primehubmall.com") || host.equals("www.primehubmall.com") ||
                      (BuildConfig.DEBUG && MainActivity.appOrigin().equals(uri.getScheme() + "://" + host)))) return;
                JSONObject result = new JSONObject()
                    .put("success", credited)
                    .put("alreadyClaimed", alreadyClaimed)
                    .put("reason", reason)
                    .put("message", message);
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('primehub:play-bonus-result',{detail:"
                    + result.toString() + "}));", null);
            } catch (Exception ignored) { }
        });
    }
}
