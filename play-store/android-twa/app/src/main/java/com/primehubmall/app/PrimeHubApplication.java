package com.primehubmall.app;

import android.app.Application;

/** Initialize Firebase before a background FCM delivery, not just when WebView opens. */
public final class PrimeHubApplication extends Application {
    @Override public void onCreate() {
        super.onCreate();
        PushManager.initialize(this);
    }
}
