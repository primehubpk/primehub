package com.primehubmall.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.text.TextUtils;
import android.util.Log;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

/** Data-only FCM messages: own one Android notification, optionally BigPicture. */
public class PrimeHubMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL = "primehub_offers";
    @Override public void onNewToken(String token) { PushManager.onFreshToken(getApplicationContext(), token); }

    @Override public void onMessageReceived(RemoteMessage message) {
        if (!PushManager.isActive(this)) return; // Defense in depth for OS / app opt-out.
        Map<String, String> data = message.getData();
        String title = data.get("title"), body = data.get("body"), path = data.get("path");
        if (TextUtils.isEmpty(title) || TextUtils.isEmpty(body) || !safePath(path)) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "PrimeHub offers", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Daily shopping recommendations and live deals");
            manager.createNotificationChannel(channel);
        }
        Intent open = new Intent(this, MainActivity.class);
        open.setData(Uri.parse("https://www.primehubmall.com" + path));
        open.setAction(Intent.ACTION_VIEW);
        open.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int id = (data.getOrDefault("day", "") + data.getOrDefault("slot", "")).hashCode();
        PendingIntent intent = PendingIntent.getActivity(this, id, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(this, CHANNEL)
            : new Notification.Builder(this);
        builder.setSmallIcon(R.drawable.ic_push_small)
            .setContentTitle(title).setContentText(body)
            .setAutoCancel(true).setContentIntent(intent)
            .setShowWhen(true).setWhen(System.currentTimeMillis());
        Bitmap picture = getImage(data.get("imageUrl"));
        if (picture != null) {
            builder.setStyle(new Notification.BigPictureStyle().bigPicture(picture).setBigContentTitle(title).setSummaryText(body));
        } else builder.setStyle(new Notification.BigTextStyle().bigText(body));
        manager.notify(id, builder.build());
    }

    private boolean safePath(String path) {
        return path != null && path.startsWith("/") && !path.startsWith("//")
            && path.length() < 300 && !path.contains("\n") && !path.contains("\r");
    }

    private Bitmap getImage(String value) {
        HttpURLConnection connection = null;
        try {
            if (TextUtils.isEmpty(value)) return null;
            Uri uri = Uri.parse(value);
            if (!"https".equals(uri.getScheme())) return null;
            String host = uri.getHost();
            if (!("images.primehubmall.com".equals(host) || "i.ibb.co".equals(host)
                  || "www.primehubmall.com".equals(host))) return null;
            connection = (HttpURLConnection) new URL(value).openConnection();
            connection.setConnectTimeout(2500);
            connection.setReadTimeout(2500);
            connection.setInstanceFollowRedirects(false);
            if (connection.getResponseCode() != 200 || connection.getContentLengthLong() > 2_000_000) return null;
            try (InputStream stream = connection.getInputStream()) {
                BitmapFactory.Options options = new BitmapFactory.Options();
                options.inSampleSize = 2;
                return BitmapFactory.decodeStream(stream, null, options);
            }
        } catch (Exception error) { Log.w("PrimeHubPush", "Image unavailable; text notification used", error); }
        finally { if (connection != null) connection.disconnect(); }
        return null;
    }
}
