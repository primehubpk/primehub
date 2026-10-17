package com.primehub.socialai;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.net.http.SslError;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * PrimeHub Social AI — standalone owner device browser shell.
 *
 * Provider logins are done by the OWNER on the real remote websites.
 * The operating system WebView stores first-party site cookies inside
 * this app's sandbox; no JS bridges, injected scripts or password readers.
 * It cannot remotely control platforms or publish content without actions.
 */
public final class MainActivity extends Activity {
    private static final int INK = Color.rgb(24, 42, 53);
    private static final int WHITE = Color.WHITE;
    private static final int MINT = Color.rgb(219, 245, 180);
    private static final int PAPER = Color.rgb(248, 250, 249);
    private static final int MUTED = Color.rgb(109, 127, 131);
    private static final int BORDER = Color.rgb(224, 233, 229);
    private static final int UPLOAD_REQUEST_CODE = 1874;
    private static final String STUDIO_URL = "https://primehub-social-ai-primehubmall.vercel.app/";
    private static final String PREFS_NAME = "primehub-social-native-1";

    private final List<Site> presets = new ArrayList<>();
    private final List<Site> custom = new ArrayList<>();
    private SharedPreferences prefs;
    private LinearLayout mainContainer;
    private FrameLayout contentContainer;
    private TextView headerTitle;
    private TextView originView;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private boolean showingWeb = false;
    private String activeUrl = STUDIO_URL;

    private static final class Site {
        final String name;
        final String url;
        final String icon;
        final boolean custom;
        Site(String name, String url, String icon, boolean custom) {
            this.name = name;
            this.url = url;
            this.icon = icon;
            this.custom = custom;
        }
    }

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(INK);
        getWindow().setNavigationBarColor(INK);
        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        CookieManager.getInstance().setAcceptCookie(true);
        addPresets();
        restoreCustom();
        createShell();
        showHome();
        handleOpenRequest(getIntent());
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleOpenRequest(intent);
    }

    private void handleOpenRequest(Intent intent) {
        if (intent == null || !"com.primehub.socialai.OPEN_SITE".equals(intent.getAction())) return;
        String url=validateHttps(intent.getStringExtra("safe_url"));
        if (url == null) {toast("Invalid HTTPS destination");return;}
        openSite(url);
    }

    private void addPresets() {
        presets.add(new Site("PrimeHub Social Studio", STUDIO_URL, "PH", false));
        presets.add(new Site("Facebook", "https://www.facebook.com/", "f", false));
        presets.add(new Site("Meta Business Suite", "https://business.facebook.com/", "M", false));
        presets.add(new Site("Instagram", "https://www.instagram.com/", "◎", false));
        presets.add(new Site("TikTok Studio", "https://www.tiktok.com/tiktokstudio", "♪", false));
        presets.add(new Site("YouTube Studio", "https://studio.youtube.com/", "▶", false));
        presets.add(new Site("WhatsApp Web", "https://web.whatsapp.com/", "◉", false));
        presets.add(new Site("Google Business", "https://business.google.com/", "G", false));
        presets.add(new Site("Canva", "https://www.canva.com/", "C", false));
        presets.add(new Site("CapCut", "https://www.capcut.com/", "✂", false));
        presets.add(new Site("Metricool", "https://app.metricool.com/", "M", false));
        presets.add(new Site("Windsor.ai", "https://onboard.windsor.ai/", "W", false));
        presets.add(new Site("Pinterest", "https://www.pinterest.com/", "P", false));
        presets.add(new Site("GitHub", "https://github.com/", "⌘", false));
        presets.add(new Site("Vercel", "https://vercel.com/dashboard", "▲", false));
        presets.add(new Site("Supabase", "https://supabase.com/dashboard", "S", false));
        presets.add(new Site("PrimeHubMall", "https://www.primehubmall.com/", "PH", false));
    }

    private static String validateHttps(String raw) {
        if (raw == null || raw.length() > 500) return null;
        try {
            URI uri = new URI(raw.trim());
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) ||
                    host == null || host.length() > 240 ||
                    !host.contains(".") || host.contains("..") ||
                    "localhost".equalsIgnoreCase(host) || host.endsWith(".local") ||
                    host.matches("\\d+\\.\\d+\\.\\d+\\.\\d+") ||
                    uri.getUserInfo() != null || uri.getPort() != -1) return null;
            return uri.toString();
        } catch (Exception ignored) { return null; }
    }

    private void restoreCustom() {
        try {
            JSONArray arr = new JSONArray(prefs.getString("sites", "[]"));
            for (int i = 0; i < Math.min(100, arr.length()); i++) {
                JSONObject row = arr.optJSONObject(i);
                if (row == null) continue;
                String name = row.optString("name", "").trim();
                String url = validateHttps(row.optString("url", ""));
                if (name.length() >= 2 && name.length() <= 46 && url != null)
                    custom.add(new Site(name, url, name.substring(0, Math.min(2, name.length())).toUpperCase(Locale.ROOT), true));
            }
        } catch (JSONException ignored) { }
    }

    private void saveCustom() {
        JSONArray arr = new JSONArray();
        for (Site site : custom) {
            JSONObject row = new JSONObject();
            try {
                row.put("name", site.name);
                row.put("url", site.url);
                arr.put(row);
            } catch (JSONException ignored) { }
        }
        prefs.edit().putString("sites", arr.toString()).apply();
    }

    private static GradientDrawable shape(int fill, int borderColor, int radius) {
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(fill);
        bg.setCornerRadius(radius);
        if (borderColor != 0) bg.setStroke(1, borderColor);
        return bg;
    }
    private int dp(int number) { return Math.round(getResources().getDisplayMetrics().density * number); }
    private LinearLayout column() {
        LinearLayout view = new LinearLayout(this);
        view.setOrientation(LinearLayout.VERTICAL);
        return view;
    }
    private TextView text(String value, int sp, int color, boolean bold) {
        TextView result = new TextView(this);
        result.setText(value);
        result.setTextSize(sp);
        result.setTextColor(color);
        if (bold) result.setTypeface(null, Typeface.BOLD);
        return result;
    }
    private Button button(String value, boolean primary) {
        Button b = new Button(this);
        b.setText(value);
        b.setAllCaps(false);
        b.setTextSize(12);
        b.setTextColor(primary ? INK : INK);
        b.setBackground(shape(primary ? MINT : WHITE, primary ? 0 : BORDER, dp(11)));
        b.setMinHeight(dp(42));
        b.setMinimumHeight(dp(42));
        b.setPadding(dp(12), 0, dp(12), 0);
        return b;
    }
    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }
    private LinearLayout.LayoutParams margins(int w, int h, int left, int top, int right, int bottom) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(w < 0 ? w : dp(w), h < 0 ? h : dp(h));
        lp.setMargins(dp(left), dp(top), dp(right), dp(bottom));
        return lp;
    }

    private void createShell() {
        mainContainer = column();
        mainContainer.setBackgroundColor(PAPER);
        setContentView(mainContainer);

        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(16), dp(12), dp(16), dp(12));
        header.setBackgroundColor(WHITE);
        TextView logo = text("P✦", 21, MINT, true);
        logo.setGravity(Gravity.CENTER);
        logo.setBackground(shape(INK, 0, dp(13)));
        header.addView(logo, margins(dp(45), dp(45), 0, 0, 10, 0));

        LinearLayout names = column();
        headerTitle = text("primehub.", 22, INK, true);
        originView = text("SOCIAL AI · PRIVATE BROWSER", 9, MUTED, true);
        names.addView(headerTitle);
        names.addView(originView, margins(-1, -2, 0, 3, 0, 0));
        header.addView(names, new LinearLayout.LayoutParams(0, -2, 1));

        Button add = button("＋ Add", true);
        add.setOnClickListener(v -> addSiteDialog());
        header.addView(add, margins(-2, dp(43), 2, 0, 0, 0));
        mainContainer.addView(header, new LinearLayout.LayoutParams(-1, -2));

        contentContainer = new FrameLayout(this);
        mainContainer.addView(contentContainer, new LinearLayout.LayoutParams(-1, 0, 1));

        LinearLayout footer = new LinearLayout(this);
        footer.setPadding(dp(12), dp(10), dp(12), dp(10));
        footer.setGravity(Gravity.CENTER_VERTICAL);
        footer.setBackgroundColor(WHITE);

        Button home = button("⌂ Home", false);
        home.setOnClickListener(v -> showHome());
        footer.addView(home, new LinearLayout.LayoutParams(0, dp(45), 1));

        Button back = button("← Back", false);
        back.setOnClickListener(v -> goBack());
        footer.addView(back, margins(0, dp(45), 7, 0, 7, 0));
        ((LinearLayout.LayoutParams)back.getLayoutParams()).width=0;
        ((LinearLayout.LayoutParams)back.getLayoutParams()).weight=1;

        Button chrome = button("↗ Chrome", true);
        chrome.setOnClickListener(v -> openOutside(showingWeb && web != null ? web.getUrl() : activeUrl));
        footer.addView(chrome, new LinearLayout.LayoutParams(0, dp(45), 1));
        Button tasks = button("✦ AI Tasks", true);
        tasks.setOnClickListener(v -> startActivity(new Intent(this, TaskActivity.class)));
        footer.addView(tasks, new LinearLayout.LayoutParams(0, dp(45), 1));
        mainContainer.addView(footer, new LinearLayout.LayoutParams(-1, -2));
    }

    private void showHome() {
        showingWeb = false;
        headerTitle.setText("primehub.");
        originView.setText("SOCIAL AI · YOUR APPS");
        contentContainer.removeAllViews();
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(false);
        LinearLayout page = column();
        page.setPadding(dp(16), dp(18), dp(16), dp(34));
        scroll.addView(page);

        LinearLayout banner = column();
        banner.setPadding(dp(20), dp(21), dp(20), dp(22));
        banner.setBackground(shape(MINT, 0, dp(22)));
        banner.addView(text("✦  YOUR PRIVATE SOCIAL WORKSPACE", 11, INK, true));
        banner.addView(text("Your apps.\nOne place.", 32, INK, true), margins(-1,-2,0,10,0,6));
        banner.addView(text("Open your real websites inside this Android app. Logins may stay saved on this device until each provider expires them.", 13, INK, false), margins(-1,-2,0,0,0,14));
        Button studio = button("✎  Open Content Studio", false);
        studio.setOnClickListener(v -> openSite(STUDIO_URL));
        banner.addView(studio, new LinearLayout.LayoutParams(-1,dp(47)));
        Button taskInbox = button("✦  AI task inbox & reminders", false);
        taskInbox.setOnClickListener(v -> startActivity(new Intent(this, TaskActivity.class)));
        banner.addView(taskInbox, margins(-1, dp(47), 0, 8, 0, 0));
        page.addView(banner, new LinearLayout.LayoutParams(-1,-2));

        TextView warning = text("🔐  Sessions belong to this app's Android WebView, not Chrome. Some platforms may require opening the normal browser to sign in. No passwords are collected by PrimeHub Social AI.", 12, MUTED, false);
        warning.setBackground(shape(WHITE, BORDER, dp(13)));
        warning.setPadding(dp(13),dp(13),dp(13),dp(13));
        page.addView(warning, margins(-1,-2,0,15,0,14));

        TextView appsTitle = text("Your added apps  ·  " + custom.size(), 19, INK, true);
        page.addView(appsTitle, margins(-1,-2,0,5,0,7));
        if (custom.isEmpty()) {
            TextView empty = text("No apps added yet. Tap + Add above to include any trusted HTTPS website.", 12, MUTED,false);
            page.addView(empty, margins(-1,-2,0,0,0,14));
        } else {
            for (Site site : custom) page.addView(siteRow(site), margins(-1,-2,0,0,0,9));
        }

        TextView popular = text("Popular applications",19,INK,true);
        page.addView(popular,margins(-1,-2,0,18,0,12));
        for (Site site : presets) page.addView(siteRow(site),margins(-1,-2,0,0,0,9));
        contentContainer.addView(scroll, new FrameLayout.LayoutParams(-1,-1));
    }

    private View siteRow(Site site) {
        LinearLayout row = new LinearLayout(this);
        row.setBackground(shape(WHITE, BORDER, dp(14)));
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(11),dp(12),dp(11),dp(12));

        TextView logo = text(site.icon,17,INK,true);
        logo.setGravity(Gravity.CENTER);
        logo.setBackground(shape(MINT,0,dp(11)));
        row.addView(logo,new LinearLayout.LayoutParams(dp(45),dp(45)));

        LinearLayout labels = column();
        labels.addView(text(site.name,14,INK,true));
        Uri uri=Uri.parse(site.url);
        labels.addView(text(uri.getHost()==null?"Website":uri.getHost(),10,MUTED,false));
        row.addView(labels,margins(0,-2,10,0,8,0));
        ((LinearLayout.LayoutParams)labels.getLayoutParams()).weight=1;

        Button visit=button("Open",true);
        visit.setOnClickListener(v -> openSite(site.url));
        row.addView(visit,new LinearLayout.LayoutParams(-2,dp(41)));
        if (site.custom) {
            TextView remove=text("×",25,MUTED,true);
            remove.setGravity(Gravity.CENTER);
            remove.setContentDescription("Remove " + site.name);
            remove.setOnClickListener(v -> new AlertDialog.Builder(this)
                 .setTitle("Remove shortcut?")
                 .setMessage("Remove " + site.name + " from this device? This will not log you out.")
                 .setNegativeButton("Cancel",null)
                 .setPositiveButton("Remove",(d,w)->{custom.remove(site);saveCustom();showHome();}).show());
            row.addView(remove,margins(dp(32),dp(43),4,0,0,0));
        }
        return row;
    }

    private void addSiteDialog() {
        LinearLayout form = column();
        form.setPadding(dp(20),dp(10),dp(20),dp(4));
        EditText label=new EditText(this);
        label.setSingleLine(true);
        label.setHint("App name, e.g. TikTok");
        label.setTextSize(15);
        form.addView(label,new LinearLayout.LayoutParams(-1,dp(60)));

        EditText website=new EditText(this);
        website.setSingleLine(true);
        website.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        website.setHint("https://example.com/");
        website.setTextSize(15);
        form.addView(website,new LinearLayout.LayoutParams(-1,dp(60)));

        AlertDialog dialog=new AlertDialog.Builder(this)
            .setTitle("Add application")
            .setMessage("Add a website, then open it to sign in. PrimeHub Social AI does not request or save your password.")
            .setView(form)
            .setNegativeButton("Cancel",null)
            .setPositiveButton("Save",null).create();
        dialog.setOnShowListener(v -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(b -> {
            String name=label.getText().toString().trim();
            String url=validateHttps(website.getText().toString());
            if (name.length()<2 || name.length()>45) {label.setError("Use 2–45 characters");return;}
            if (url==null) {website.setError("Enter a valid public HTTPS website");return;}
            if (custom.size()>=100) {toast("Maximum 100 custom apps");return;}
            for (Site s:custom) if (s.url.equals(url)){website.setError("Already added");return;}
            custom.add(0,new Site(name,url,name.substring(0,Math.min(2,name.length())).toUpperCase(Locale.ROOT),true));
            saveCustom();
            dialog.dismiss();
            showHome();
            toast("App saved — open it to sign in.");
        }));
        dialog.show();
    }

    private void ensureWeb() {
        if(web!=null)return;
        web=new WebView(this);
        WebSettings s=web.getSettings();
        s.setJavaScriptEnabled(true); // Social websites require JavaScript.
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        // Content access is needed for the user-selected Android media picker.
        s.setAllowContentAccess(true);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setLoadsImagesAutomatically(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        if(android.os.Build.VERSION.SDK_INT>=android.os.Build.VERSION_CODES.O) {
            s.setSafeBrowsingEnabled(true);
        }
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if (uri == null) return true;
                String scheme=uri.getScheme();
                if ("primehubsocial".equalsIgnoreCase(scheme) && 
                    "import".equalsIgnoreCase(uri.getHost())) {
                    Intent handoff = new Intent(MainActivity.this, TaskActivity.class);
                    handoff.setAction(Intent.ACTION_VIEW);
                    handoff.setData(uri);
                    startActivity(handoff);
                    return true;
                }
                if (!"https".equalsIgnoreCase(scheme)) {
                    // Never auto-launch custom URI handlers or insecure HTTP redirects.
                    toast("For safety, open this link in a trusted external browser.");
                    return true;
                }
                return false;
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (url != null && url.startsWith("https://")) {
                    activeUrl=url;
                    setOrigin(url);
                    CookieManager.getInstance().flush();
                }
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();toast("Security certificate problem — site blocked.");
            }
            @Override public void onReceivedHttpAuthRequest(WebView view, android.webkit.HttpAuthHandler handler, String host, String realm) {
                handler.cancel();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest req) { req.deny(); }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin,false,false);
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if(fileCallback!=null)fileCallback.onReceiveValue(null);
                fileCallback=callback;
                try{
                    Intent chooser=params.createIntent();
                    chooser.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(chooser,UPLOAD_REQUEST_CODE);
                    return true;
                }catch(Exception ignored){
                    fileCallback=null;
                    callback.onReceiveValue(null);
                    toast("File picker unavailable.");
                    return false;
                }
            }
        });
        web.setDownloadListener((url,userAgent,contentDisposition,mimeType,contentLength)->{
            if (url!=null && url.startsWith("https://")) {
                toast("Downloads open in your regular browser.");
                openOutside(url);
            } else toast("Download blocked: insecure link.");
        });
    }

    private void setOrigin(String url) {
        Uri uri=Uri.parse(url);
        String host=uri.getHost();
        originView.setText(host==null?"Website":"🔒  "+host);
    }

    private void openSite(String url) {
        String validated=validateHttps(url);
        if(validated==null){toast("Only public HTTPS websites can be opened.");return;}
        ensureWeb();
        showingWeb=true;
        contentContainer.removeAllViews();
        LinearLayout screen=column();
        LinearLayout controls=new LinearLayout(this);
        controls.setGravity(Gravity.CENTER_VERTICAL);
        controls.setPadding(dp(14),dp(8),dp(14),dp(8));
        controls.setBackgroundColor(WHITE);
        Button refresh=button("⟳ Reload",false);
        refresh.setOnClickListener(v -> web.reload());
        controls.addView(refresh,new LinearLayout.LayoutParams(0,dp(38),1));
        Button share=button("↗ Open Chrome",false);
        share.setOnClickListener(v -> openOutside(web.getUrl()));
        controls.addView(share,margins(0,dp(38),9,0,0,0));
        ((LinearLayout.LayoutParams)share.getLayoutParams()).weight=1;
        screen.addView(controls,new LinearLayout.LayoutParams(-1,-2));

        if(web.getParent() instanceof ViewGroup) ((ViewGroup)web.getParent()).removeView(web);
        screen.addView(web,new LinearLayout.LayoutParams(-1,0,1));
        contentContainer.addView(screen,new FrameLayout.LayoutParams(-1,-1));
        headerTitle.setText("Social browser");
        setOrigin(validated);
        activeUrl=validated;
        web.loadUrl(validated);
        if(!prefs.getBoolean("native_notice_seen",false)){
            prefs.edit().putBoolean("native_notice_seen",true).apply();
            new AlertDialog.Builder(this)
                .setTitle("Real websites, local browser")
                .setMessage("Sign in only on the genuine website shown in the top address label. This Android WebView keeps its own cookies; Chrome's saved logins are separate. Some platforms, particularly Google, can block embedded login — use Open Chrome if that happens. Automatic posting is not enabled.")
                .setPositiveButton("Got it",null).show();
        }
    }

    private void openOutside(String url) {
        String clean=validateHttps(url);
        if(clean==null){toast("No secure web URL to open.");return;}
        try{
            Intent i=new Intent(Intent.ACTION_VIEW,Uri.parse(clean));
            i.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(i);
        } catch(ActivityNotFoundException ex) {toast("Install a browser to open this page.");}
    }
    private void goBack(){
        if(showingWeb && web!=null && web.canGoBack())web.goBack();
        else showHome();
    }
    @Override public void onBackPressed(){goBack();}
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode==UPLOAD_REQUEST_CODE&&fileCallback!=null){
            Uri[] result=WebChromeClient.FileChooserParams.parseResult(resultCode,data);
            fileCallback.onReceiveValue(result);
            fileCallback=null;
        }
    }
    @Override protected void onPause(){super.onPause();CookieManager.getInstance().flush();}
    @Override protected void onDestroy(){
        if(fileCallback!=null){fileCallback.onReceiveValue(null);fileCallback=null;}
        if(web!=null){
            if(web.getParent() instanceof ViewGroup)((ViewGroup)web.getParent()).removeView(web);
            web.destroy();
        }
        super.onDestroy();
    }
}
