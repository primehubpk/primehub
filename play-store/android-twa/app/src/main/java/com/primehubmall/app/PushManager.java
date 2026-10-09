package com.primehubmall.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Base64;
import android.util.Log;
import android.webkit.WebView;

import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Separate from MainActivity navigation: failure in push must NEVER close the v9 WebView.
 * No JavaScriptInterface exposed to subframes; only the two trusted first-party origins.
 */
public final class PushManager {
    private static final String TAG = "PrimeHubPush";
    private static final String API = "https://www.primehubmall.com/api/notifications/device";
    private static final String PREFERENCES = "primehub-push-v10";
    private static final String ID = "installation-id", SECRET = "installation-secret";
    private static final String ENABLED = "enabled", REQUESTED = "permission-requested";
    private static final String PENDING_ORDER = "pending-order";
    private static final ExecutorService worker = Executors.newSingleThreadExecutor();
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static boolean configured = false;
    private static boolean bridgeReady = false;
    private static long startedAt = SystemClock.elapsedRealtime();
    private static int distinctPages = 0;
    private static String previousPage = "";
    private static String currentPath = "/";
    private static Activity foreground;

    private PushManager() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    public static synchronized void initialize(Context context) {
        if (configured) return;
        String appId = BuildConfig.FIREBASE_ANDROID_APP_ID;
        if (!appId.startsWith("1:") || !appId.contains(":android:")) {
            Log.w(TAG, "Android Firebase app ID is not configured; push disabled, shopping continues.");
            return;
        }
        try {
            if (FirebaseApp.getApps(context).isEmpty()) {
                FirebaseOptions options = new FirebaseOptions.Builder()
                    .setApplicationId(appId)
                    .setApiKey(BuildConfig.FIREBASE_API_KEY)
                    .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
                    .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
                    .build();
                FirebaseApp.initializeApp(context.getApplicationContext(), options);
            }
            configured = true;
            FirebaseMessaging.getInstance().setAutoInitEnabled(true);
        } catch (Exception error) {
            Log.e(TAG, "FCM initialization failed; WebView unaffected.", error);
        }
    }

    private static String installId(Context context) {
        SharedPreferences p = prefs(context);
        String id = p.getString(ID, "");
        if (id.isEmpty()) {
            id = UUID.randomUUID().toString();
            p.edit().putString(ID, id).apply();
        }
        return id;
    }

    private static String installSecret(Context context) {
        SharedPreferences p = prefs(context);
        String secret = p.getString(SECRET, "");
        if (secret.isEmpty()) {
            byte[] bytes = new byte[32];
            new SecureRandom().nextBytes(bytes);
            secret = Base64.encodeToString(bytes, Base64.NO_WRAP | Base64.NO_PADDING | Base64.URL_SAFE);
            p.edit().putString(SECRET, secret).apply();
        }
        return secret;
    }

    static boolean osAllows(Context context) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        return manager != null && manager.areNotificationsEnabled()
            && (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED);
    }

    private static boolean wantsPush(Context context) { return prefs(context).getBoolean(ENABLED, true); }

    static boolean isActive(Context context) {
        return wantsPush(context) && osAllows(context);
    }

    public static void attach(Activity activity, WebView view) {
        initialize(activity);
        if (bridgeReady || !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        try {
            Set<String> origins = new HashSet<>(Arrays.asList("https://www.primehubmall.com", "https://primehubmall.com"));
            WebViewCompat.addWebMessageListener(view, "PrimeHubNative", origins,
                (webview, message, origin, isMainFrame, reply) -> {
                    if (!isMainFrame || origin == null || !origins.contains(origin.toString())) return;
                    try {
                        JSONObject json = new JSONObject(message.getData());
                        String action = json.optString("action", "");
                        if ("settings".equals(action)) {
                            reply.postMessage(settingsJson(activity).toString());
                        } else if ("toggle".equals(action)) {
                            boolean enabled = json.optBoolean("enabled", false);
                            prefs(activity).edit().putBoolean(ENABLED, enabled).apply();
                            syncPreferences(activity);
                            if (enabled && !osAllows(activity)) openOsSettings(activity);
                            if (enabled) refreshToken(activity);
                            reply.postMessage(settingsJson(activity).toString());
                        } else if ("purchase".equals(action)) {
                            String orderId = json.optString("orderId", "");
                            if (orderId.matches("[0-9a-fA-F-]{36}")) {
                                prefs(activity).edit().putString(PENDING_ORDER, orderId).apply();
                                sendPurchase(activity, orderId);
                            }
                        } else if ("view".equals(action)) {
                            String path = json.optString("path", "");
                            if (validPath(path)) pageSeen(activity, path);
                        }
                    } catch (Exception error) { Log.w(TAG, "Browser push bridge message ignored", error); }
                });
            bridgeReady = true;
        } catch (Exception error) { Log.w(TAG, "WebView bridge unsupported; shopping continues", error); }
    }

    private static JSONObject settingsJson(Context context) {
        JSONObject state = new JSONObject();
        try {
            state.put("type", "settings");
            state.put("enabled", wantsPush(context));
            state.put("allowed", osAllows(context));
            state.put("supported", configured);
        } catch (Exception ignored) {}
        return state;
    }

    private static void openOsSettings(Activity activity) {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= 26) {
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, activity.getPackageName());
            } else {
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + activity.getPackageName()));
            }
            activity.startActivity(intent);
        } catch (Exception ignored) {}
    }

    public static void onResume(Activity activity) {
        foreground = activity;
        initialize(activity);
        if (configured) {
            refreshToken(activity);
            String pending = prefs(activity).getString(PENDING_ORDER, "");
            if (!pending.isEmpty()) sendPurchase(activity, pending);
        }
        maybeRequestPermission(activity);
    }

    public static void onPause(Activity activity) {
        if (foreground == activity) foreground = null;
    }

    public static void onPermissionResult(Activity activity) {
        syncPreferences(activity);
        refreshToken(activity);
    }

    public static void pageSeen(Activity activity, String path) {
        if (!validPath(path)) return;
        if (!path.equals(previousPage)) {
            distinctPages++;
            previousPage = path;
        }
        currentPath = path;
        if (configured && isActive(activity)) {
            // Page reads are cheap and updates are serialized after registration.
            worker.execute(() -> post(activity, "view", null, path, null));
        }
        maybeRequestPermission(activity);
    }

    private static boolean validPath(String path) {
        return path != null && path.startsWith("/") && !path.startsWith("//")
            && path.length() <= 300 && !path.contains("\n") && !path.contains("\r");
    }

    public static void onPageFinished(Activity activity, WebView view, String url) {
        try {
            Uri uri = Uri.parse(url);
            if (!"https".equals(uri.getScheme()) ||
                !("www.primehubmall.com".equals(uri.getHost()) || "primehubmall.com".equals(uri.getHost()))) return;
            pageSeen(activity, uri.getPath() == null ? "/" : uri.getPath());
            // Next.js uses client-side history transitions which may not call onPageFinished.
            view.evaluateJavascript("(function(){if(window.__phPushHistory)return;window.__phPushHistory=1;"
                + "var send=function(){try{window.PrimeHubNative&&window.PrimeHubNative.postMessage(JSON.stringify({action:'view',path:location.pathname}));}catch(e){}};"
                + "['pushState','replaceState'].forEach(function(k){var f=history[k];history[k]=function(){var v=f.apply(this,arguments);send();return v;};});"
                + "addEventListener('popstate',send);})();", null);
        } catch (Exception ignored) {}
    }

    private static void maybeRequestPermission(Activity activity) {
        if (Build.VERSION.SDK_INT < 33 || !configured || !wantsPush(activity) ||
            osAllows(activity) || prefs(activity).getBoolean(REQUESTED, false) ||
            distinctPages < 2 || foreground != activity) return;
        long remaining = 30_000L - (SystemClock.elapsedRealtime() - startedAt);
        if (remaining > 0) {
            main.removeCallbacksAndMessages(null);
            main.postDelayed(() -> maybeRequestPermission(activity), remaining);
            return;
        }
        prefs(activity).edit().putBoolean(REQUESTED, true).apply();
        activity.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1100);
    }

    public static void onFreshToken(Context context, String token) {
        if (configured && !token.isEmpty()) worker.execute(() -> post(context, "register", token, currentPath, null));
    }

    private static void refreshToken(Context context) {
        if (!configured) return;
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> onFreshToken(context, token))
            .addOnFailureListener(err -> Log.w(TAG, "FCM token unavailable", err));
    }

    private static void syncPreferences(Context context) {
        if (configured) worker.execute(() -> post(context, "preferences", null, null, null));
    }

    private static void sendPurchase(Context context, String orderId) {
        if (configured) worker.execute(() -> {
            if (post(context, "purchase", null, null, orderId)) {
                if (orderId.equals(prefs(context).getString(PENDING_ORDER, ""))) {
                    prefs(context).edit().remove(PENDING_ORDER).apply();
                }
            }
        });
    }

    private static boolean post(Context context, String action, String token, String path, String orderId) {
        HttpURLConnection connection = null;
        try {
            JSONObject data = new JSONObject();
            data.put("installationId", installId(context));
            data.put("installationSecret", installSecret(context));
            data.put("action", action);
            if (token != null) {
                data.put("token", token);
                data.put("allowed", osAllows(context));
                data.put("enabled", wantsPush(context));
            } else if ("preferences".equals(action)) {
                data.put("allowed", osAllows(context));
                data.put("enabled", wantsPush(context));
            }
            if (path != null && validPath(path)) data.put("path", path);
            if (orderId != null) data.put("orderId", orderId);
            connection = (HttpURLConnection) new URL(API).openConnection();
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setConnectTimeout(4000);
            connection.setReadTimeout(4500);
            connection.setDoOutput(true);
            try (OutputStream out = connection.getOutputStream()) {
                out.write(data.toString().getBytes(StandardCharsets.UTF_8));
            }
            int status = connection.getResponseCode();
            if (status >= 200 && status < 300) return true;
            Log.w(TAG, "Push sync unavailable: HTTP " + status);
        } catch (Exception error) { Log.w(TAG, "Push sync retry on next open", error); }
        finally { if (connection != null) connection.disconnect(); }
        return false;
    }
}
