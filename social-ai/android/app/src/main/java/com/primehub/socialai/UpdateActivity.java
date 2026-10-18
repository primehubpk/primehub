package com.primehub.socialai;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;

/**
 * Private owner-initiated Android app update.
 *
 * Checks a first-party HTTPS API which returns GitHub release metadata.
 * Downloads a bounded APK, verifies its SHA256, version, package ID, and
 * Android signing certificate against the installed app, then delegates to
 * the SYSTEM installer for explicit owner approval.
 *
 * Does not silently install, manipulate installed apps or touch user data.
 * A signing-key mismatch cannot be solved by a code update.
 */
public final class UpdateActivity extends Activity {
    private static final String UPDATE_URL =
        "https://primehub-social-ai-primehubmall.vercel.app/api/android-update";
    private static final String APK_NAME="primehub-social-update.apk";
    private static final long MAX_APK=75L*1024*1024;
    private static final int INK=Color.rgb(23,42,53);
    private TextView state;
    private Button checkButton,installButton;
    private String verifiedName;
    private boolean working=false;

    @Override public void onCreate(Bundle bundle) {
        super.onCreate(bundle);
        getWindow().setStatusBarColor(INK);
        show();
    }
    private int dp(int i){return Math.round(i*getResources().getDisplayMetrics().density);}
    private GradientDrawable bg(int fill){
        GradientDrawable d=new GradientDrawable();d.setColor(fill);
        d.setCornerRadius(dp(13));return d;
    }
    private TextView text(String s,int size,boolean bold){
        TextView v=new TextView(this);
        v.setText(s);v.setTextColor(INK);v.setTextSize(size);
        if(bold)v.setTypeface(null,Typeface.BOLD);
        return v;
    }
    private Button button(String label) {
        Button b=new Button(this);b.setText(label);b.setAllCaps(false);
        b.setTextSize(14);b.setTextColor(INK);b.setBackground(bg(0xffd2f4a1));
        b.setMinHeight(dp(48));return b;
    }
    private void setState(String message) { state.setText(message); }
    private void update(String message) { runOnUiThread(()->{if(!isFinishing())setState(message);}); }
    private void show() {
        ScrollView scroll=new ScrollView(this);scroll.setBackgroundColor(0xfff6f9f7);
        LinearLayout page=new LinearLayout(this);page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(19),dp(29),dp(19),dp(38));scroll.addView(page);setContentView(scroll);
        TextView eyebrow=text("✦ PRIMEHUB SOCIAL AI · ANDROID",12,true);
        eyebrow.setTextColor(0xff58864a);page.addView(eyebrow);
        TextView title=text("Keep your app updated.",28,true);
        LinearLayout.LayoutParams space=new LinearLayout.LayoutParams(-1,-2);space.topMargin=dp(19);
        page.addView(title,space);
        String version="Unknown";
        try{
            PackageInfo p=getPackageManager().getPackageInfo(getPackageName(),0);
            version=p.versionName+" (build "+getVersion(p)+")";
        }catch(PackageManager.NameNotFoundException ignored){}
        page.addView(text("Installed version: "+version,14,false),space);
        TextView desc=text("Check for official PrimeHub Social AI updates. Android will ask before installing. When the app ID and signing key match, your saved app data remains intact.",13,false);
        desc.setTextColor(0xff657981);page.addView(desc,space);
        state=text("No update checked yet. Tap Check for updates.",13,false);
        state.setTextIsSelectable(true);state.setPadding(dp(16),dp(17),dp(16),dp(17));
        state.setBackground(bg(Color.WHITE));page.addView(state,space);
        checkButton=button("⟳ Check for updates");
        checkButton.setOnClickListener(v->check());
        page.addView(checkButton,space);
        installButton=button("↓ Download and install verified update");
        installButton.setVisibility(View.GONE);
        installButton.setOnClickListener(v->download());
        page.addView(installButton,space);
        Button back=button("← Back to my applications");
        back.setOnClickListener(v->finish());page.addView(back,space);
        TextView note=text(
            "SECURITY\n"+
            "• Updates only from the PrimeHub GitHub release channel.\n"+
            "• A newer version, SHA-256 hash and SAME Android signing certificate are required.\n"+
            "• Only Android's system installer performs installation after you approve.\n"+
            "• No password, account session, or other app data is uploaded.\n"+
            "• Older test APKs were signed with different temporary debug certificates. "+
            "Those builds CANNOT be upgraded in place; a one-time move to a permanently signed build may be required.\n"+
            "• No update is currently promised until a stable signed release is published.",12,false);
        note.setPadding(dp(17),dp(20),dp(17),dp(20));note.setBackground(bg(Color.WHITE));
        page.addView(note,space);
    }
    private static long getVersion(PackageInfo info) {
        return Build.VERSION.SDK_INT>=28?info.getLongVersionCode():info.versionCode;
    }
    private static boolean secureReleaseUrl(String url) {
        return url!=null &&
            url.matches("^https://github\\.com/primehubpk/primehub/releases/download/social-ai-v[1-9][0-9]{0,5}/primehub-social-ai-debug\\.apk$");
    }
    private static String sha256(File file) throws Exception {
        MessageDigest digest=MessageDigest.getInstance("SHA-256");
        try(InputStream stream=new java.io.FileInputStream(file)) {
            byte[] chunk=new byte[32768];int count;
            while((count=stream.read(chunk))>=0) {
                if(count>0)digest.update(chunk,0,count);
            }
        }
        return hex(digest.digest());
    }
    private static String hex(byte[] data) {
        StringBuilder result=new StringBuilder(data.length*2);
        for(byte b:data)result.append(String.format(Locale.ROOT,"%02x",b&0xff));
        return result.toString();
    }
    private static byte[][] currentCerts(PackageInfo info){
        Signature[] s;
        if(Build.VERSION.SDK_INT>=28){
            if(info.signingInfo==null)return new byte[0][];
            s=info.signingInfo.getApkContentsSigners();
        }else s=info.signatures;
        if(s==null)return new byte[0][];
        byte[][] out=new byte[s.length][];
        for(int i=0;i<s.length;i++)out[i]=s[i].toByteArray();
        return out;
    }
    private void verifyArchive(File file,long minimumVersion) throws Exception {
        int flag=Build.VERSION.SDK_INT>=28?
            PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
        PackageManager pm=getPackageManager();
        PackageInfo current=pm.getPackageInfo(getPackageName(),flag);
        PackageInfo incoming=pm.getPackageArchiveInfo(file.getAbsolutePath(),flag);
        if(incoming==null)throw new IllegalArgumentException("Android rejected the downloaded APK.");
        if(!getPackageName().equals(incoming.packageName))
            throw new IllegalArgumentException("Different application ID. Update blocked.");
        if(getVersion(incoming)!=minimumVersion||getVersion(incoming)<=getVersion(current))
            throw new IllegalArgumentException("Update version does not match release metadata.");
        byte[][] existing=currentCerts(current),newCert=currentCerts(incoming);
        if(existing.length!=1||newCert.length!=1||!MessageDigest.isEqual(existing[0],newCert[0]))
            throw new IllegalArgumentException(
                "Signing certificate mismatch. This APK cannot update the installed test app. Do not uninstall before backing up important tasks."
            );
    }
    private static JSONObject getJson(String url) throws Exception {
        HttpURLConnection conn=(HttpURLConnection)new URL(url).openConnection();
        conn.setRequestMethod("GET");conn.setConnectTimeout(8000);conn.setReadTimeout(11000);
        conn.setRequestProperty("Accept","application/json");
        conn.setInstanceFollowRedirects(false);
        try{
            if(conn.getResponseCode()!=200)throw new IllegalStateException("Update service unavailable.");
            int size=conn.getContentLength();
            if(size>8192)throw new IllegalArgumentException("Invalid update manifest.");
            byte[] data=new byte[8192];int i=0,len;
            try(InputStream stream=conn.getInputStream()){
                while(i<data.length&&(len=stream.read(data,i,data.length-i))!=-1)i+=len;
                if(i==data.length&&stream.read()!=-1)throw new IllegalArgumentException("Update manifest too large.");
            }
            return new JSONObject(new String(data,0,i,java.nio.charset.StandardCharsets.UTF_8));
        }finally{conn.disconnect();}
    }
    private volatile String apkUrl,expectedSha;
    private volatile long expectedVersion;
    private void check(){
        if(working)return;working=true;checkButton.setEnabled(false);installButton.setVisibility(View.GONE);
        setState("Checking the official update channel…");
        new Thread(()->{
            try{
                JSONObject json=getJson(UPDATE_URL);
                long code=json.optLong("versionCode",0);
                if(code<1){
                    update("No permanently signed update has been published yet. Your current test app is unchanged.");
                    return;
                }
                String url=json.optString("apkUrl","");
                String sha=json.optString("sha256","");
                String pkg=json.optString("packageName","");
                if(!secureReleaseUrl(url)||!sha.matches("[a-f0-9]{64}")||!getPackageName().equals(pkg))
                    throw new IllegalStateException("Release metadata is invalid or intended for a different app.");
                PackageInfo current=getPackageManager().getPackageInfo(getPackageName(),0);
                if(code<=getVersion(current)){
                    update("You are already running the latest published signed build.");
                    return;
                }
                apkUrl=url;expectedSha=sha;expectedVersion=code;verifiedName=json.optString("versionName","");
                runOnUiThread(()->{
                    if(isFinishing())return;
                    setState("Update available: "+verifiedName+" (build "+code+").\\n\\nTap Download. We will verify its signature before Android's installer is opened.");
                    installButton.setVisibility(View.VISIBLE);
                });
            }catch(Exception e){update("Could not check for a verified update: "+e.getMessage());}
            finally{runOnUiThread(()->{working=false;checkButton.setEnabled(true);});}
        },"PrimeHub-Update-Check").start();
    }
    private void download(){
        if(working||apkUrl==null||expectedSha==null||expectedVersion<1)return;
        new AlertDialog.Builder(this)
            .setTitle("Download official APK update?")
            .setMessage("An Android system install screen will ask for approval. This app never installs silently. Your saved data stays only when the Android package name and signing certificate match.")
            .setNegativeButton("Cancel",null)
            .setPositiveButton("Download",(d,w)->startDownload())
            .show();
    }
    private void startDownload(){
        if(working)return;
        working=true;installButton.setEnabled(false);checkButton.setEnabled(false);
        setState("Downloading verified APK… Please keep the app open.");
        new Thread(()->{
            File file=new File(getCacheDir(),APK_NAME);
            try{
                URL requested=new URL(apkUrl);
                if(!secureReleaseUrl(requested.toString()))
                    throw new IllegalArgumentException("Untrusted release URL.");
                HttpURLConnection connection=(HttpURLConnection)requested.openConnection();
                connection.setConnectTimeout(10000);connection.setReadTimeout(20000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent","PrimeHubSocialAI-Android-Updater/1.0");
                long total=0;
                try {
                    if(connection.getResponseCode()!=200)throw new IllegalArgumentException("Release download unavailable.");
                    try(InputStream input=connection.getInputStream();FileOutputStream out=new FileOutputStream(file)){
                        byte[] buffer=new byte[32768];int n;
                        while((n=input.read(buffer))!=-1){
                            total+=n;
                            if(total>MAX_APK)throw new IllegalArgumentException("Update exceeds size limit.");
                            out.write(buffer,0,n);
                        }
                    }
                }finally{connection.disconnect();}
                if(total<10240)throw new IllegalArgumentException("Downloaded update is incomplete.");
                if(!MessageDigest.isEqual(hexToBytes(sha256(file)),hexToBytes(expectedSha)))
                    throw new IllegalArgumentException("SHA-256 mismatch: update was rejected.");
                verifyArchive(file,expectedVersion);
                update("Verified package, version, SHA-256 and signer. Opening Android's installer for your approval…");
                runOnUiThread(()->install(file));
            }catch(Exception e){
                file.delete();
                update("Update blocked: "+e.getMessage());
            }finally{
                runOnUiThread(()->{working=false;checkButton.setEnabled(true);installButton.setEnabled(true);});
            }
        },"PrimeHub-Verified-Update").start();
    }
    private static byte[] hexToBytes(String value) {
        byte[] b=new byte[value.length()/2];
        for(int i=0;i<b.length;i++)b[i]=(byte)Integer.parseInt(value.substring(i*2,i*2+2),16);
        return b;
    }
    private void install(File apk){
        if(Build.VERSION.SDK_INT>=26&&!getPackageManager().canRequestPackageInstalls()){
            setState("Android requires you to allow installation from PrimeHub Social AI. Enable it in the Android settings, return here and tap Download again.");
            Intent settings=new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:"+getPackageName()));
            try{startActivity(settings);}
            catch(ActivityNotFoundException e){setState("Open Android settings to approve installation permissions.");}
            return;
        }
        try{
            Uri fileUri=new Uri.Builder().scheme("content").authority(getPackageName()+".apkfile")
                .appendPath("verified-update.apk").build();
            Intent install=new Intent(Intent.ACTION_VIEW);
            install.setDataAndType(fileUri,"application/vnd.android.package-archive");
            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(install);
        }catch(ActivityNotFoundException ex){
            setState("No Android package installer is available.");
        }
    }
}
