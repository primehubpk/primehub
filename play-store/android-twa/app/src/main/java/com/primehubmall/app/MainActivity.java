package com.primehubmall.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ImageView;

/**
 * Real in-app activity for PrimeHubMall. The previous TWA trampoline launched Chrome
 * and then called finish(), which made the Play build look like it opened and closed.
 */
public class MainActivity extends Activity {
    static final String HOME_URL = "https://www.primehubmall.com/";
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final long SPLASH_TIMEOUT_MS = 8000;

    private WebView webView;
    private ImageView splash;
    private ValueCallback<Uri[]> filePathCallback;
    private boolean splashHidden;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        webView = findViewById(R.id.webview);
        splash = findViewById(R.id.splash);
        configureWebView();
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
            hideSplash();
        } else {
            webView.loadUrl(urlFromIntent(getIntent()));
        }
        handler.postDelayed(this::hideSplash, SPLASH_TIMEOUT_MS);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String url = urlFromIntent(intent);
        if (url != null && webView != null) {
            webView.loadUrl(url);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " PrimeHubApp/9.0.0");
        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);
        webView.setWebViewClient(new StoreWebViewClient());
        webView.setWebChromeClient(new StoreChromeClient());
    }

    private String urlFromIntent(Intent intent) {
        if (intent != null && intent.getData() != null) {
            Uri data = intent.getData();
            if (isTrustedUrl(data)) {
                return data.toString();
            }
        }
        return HOME_URL;
    }

    private boolean isTrustedUrl(Uri uri) {
        if (uri == null || uri.getScheme() == null || uri.getHost() == null) {
            return false;
        }
        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            return false;
        }
        String host = uri.getHost().toLowerCase();
        return host.equals("www.primehubmall.com")
                || host.equals("primehubmall.com")
                || host.endsWith(".primehubmall.com");
    }

    private boolean shouldStayInApp(Uri uri) {
        return isTrustedUrl(uri);
    }

    private void hideSplash() {
        if (splashHidden || splash == null) {
            return;
        }
        splashHidden = true;
        splash.animate().alpha(0f).setDuration(220).withEndAction(() -> splash.setVisibility(View.GONE));
    }

    private void openExternal(Uri uri) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(intent);
        } catch (ActivityNotFoundException ignored) {
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || filePathCallback == null) {
            return;
        }
        Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        filePathCallback.onReceiveValue(result);
        filePathCallback = null;
    }

    private class StoreWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handleUrl(request.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleUrl(Uri.parse(url));
        }

        private boolean handleUrl(Uri uri) {
            if (uri == null) {
                return true;
            }
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
            if ("tel".equals(scheme) || "mailto".equals(scheme) || "sms".equals(scheme)
                    || "smsto".equals(scheme) || "whatsapp".equals(scheme) || "intent".equals(scheme)
                    || "geo".equals(scheme)) {
                if ("intent".equals(scheme)) {
                    try {
                        startActivity(Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME));
                    } catch (Exception ignored) {
                    }
                } else {
                    openExternal(uri);
                }
                return true;
            }
            if (shouldStayInApp(uri)) {
                return false;
            }
            openExternal(uri);
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            hideSplash();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request == null || request.isForMainFrame()) {
                hideSplash();
            }
        }
    }

    private class StoreChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                         FileChooserParams params) {
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(null);
            }
            filePathCallback = callback;
            try {
                startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST);
            } catch (Exception e) {
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                startActivityForResult(Intent.createChooser(intent, "Choose file"), FILE_CHOOSER_REQUEST);
            }
            return true;
        }

        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture,
                                      android.os.Message resultMsg) {
            WebView.HitTestResult result = view.getHitTestResult();
            String extra = result != null ? result.getExtra() : null;
            if (extra != null) {
                Uri uri = Uri.parse(extra);
                if (shouldStayInApp(uri)) {
                    view.loadUrl(extra);
                } else {
                    openExternal(uri);
                }
                return false;
            }
            return false;
        }
    }
}
