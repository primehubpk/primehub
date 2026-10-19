package com.primehub.socialai;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Official TikTok Login Kit account linking, NOT TikTok account password login.
 * Chrome displays TikTok's own verified OAuth login/consent page.
 * No passwords, cookies, access or refresh tokens are accessible to this app.
 * Read-only verified identity is shown only after server OAuth verification.
 */
public final class TikTokAccountActivity extends Activity {
  private static final String API="https://primehub-social-ai-primehubmall.vercel.app/api/tiktok-account";
  private static final String PAIR_PREFS="primehub-social-owner-pairing-v1";
  private static final int INK=Color.rgb(23,43,53),MINT=0xffd6f5b0;
  private final Handler ui=new Handler(Looper.getMainLooper());
  private TextView status,details;
  private Button connect,disconnect;
  private boolean busy=false,connected=false,loginReady=false,openedExternal=false;
  private String deviceId,deviceToken;
  @Override public void onCreate(Bundle saved){
    super.onCreate(saved);
    getWindow().setStatusBarColor(INK);
    SharedPreferences p=getSharedPreferences(PAIR_PREFS,MODE_PRIVATE);
    deviceId=p.getString("id",null);deviceToken=p.getString("secret",null);
    render();
    refresh();
  }
  @Override protected void onResume(){
    super.onResume();
    if(openedExternal){openedExternal=false;ui.postDelayed(()->refresh(),1000);}
  }
  private int dp(int x){return Math.round(x*getResources().getDisplayMetrics().density);}
  private GradientDrawable shape(int fill){
    GradientDrawable g=new GradientDrawable();g.setColor(fill);g.setCornerRadius(dp(14));return g;
  }
  private TextView txt(String s,int size,boolean bold){
    TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(INK);
    if(bold)t.setTypeface(null,Typeface.BOLD);
    return t;
  }
  private Button btn(String s,boolean primary){
    Button b=new Button(this);b.setText(s);b.setAllCaps(false);b.setTextSize(14);
    b.setTextColor(INK);b.setBackground(shape(primary?MINT:Color.WHITE));
    b.setMinHeight(dp(48));return b;
  }
  private void row(LinearLayout p,android.view.View v,int top){
    LinearLayout.LayoutParams space=new LinearLayout.LayoutParams(-1,-2);space.topMargin=dp(top);
    p.addView(v,space);
  }
  private void render(){
    ScrollView scroll=new ScrollView(this);scroll.setBackgroundColor(0xfff6f9f8);
    LinearLayout page=new LinearLayout(this);page.setOrientation(LinearLayout.VERTICAL);
    page.setPadding(dp(19),dp(27),dp(19),dp(32));scroll.addView(page);setContentView(scroll);
    row(page,txt("✦ PRIMEHUB SOCIAL AI · PRIVATE",12,true),0);
    row(page,txt("Connect your TikTok account",26,true),19);
    row(page,txt("Add your own TikTok account through TikTok's official login and permission screen, not by launching your existing TikTok application.",14,false),13);
    status=txt("Checking connection…",16,true);
    status.setPadding(dp(17),dp(17),dp(17),dp(17));
    status.setBackground(shape(Color.WHITE));row(page,status,23);
    details=txt("A successful official login can verify your TikTok display name here. We do not read your password or existing TikTok app login.",13,false);
    row(page,details,13);
    connect=btn("🔐 Connect TikTok account",true);connect.setOnClickListener(v->connect());
    row(page,connect,25);
    Button check=btn("↻ Check connected account",false);check.setOnClickListener(v->refresh());
    row(page,check,9);
    Button nativeApp=btn("↗ Open original TikTok (optional)",false);
    nativeApp.setOnClickListener(v->{
       Intent intent=getPackageManager().getLaunchIntentForPackage("com.zhiliaoapp.musically");
       if(intent!=null){startActivity(intent);return;}
       openExternal("https://www.tiktok.com/");});
    row(page,nativeApp,9);
    disconnect=btn("Disconnect verified identity",false);
    disconnect.setOnClickListener(v->new AlertDialog.Builder(this)
       .setTitle("Disconnect TikTok identity?")
       .setMessage("Remove TikTok's verified profile name from PrimeHub Social AI? It does not sign you out of TikTok.")
       .setNegativeButton("Cancel",null).setPositiveButton("Disconnect",(d,w)->call("disconnect")).show());
    row(page,disconnect,9);
    Button back=btn("← Back to my apps",false);back.setOnClickListener(v->finish());row(page,back,9);
    TextView note=txt("Important: TikTok passwords stay on TikTok's official page. A connected profile is read-only verification, NOT permission for ChatGPT to operate TikTok or automatically publish posts. Publishing requires separate TikTok Content Posting API approval.",12,false);
    note.setPadding(dp(15),dp(15),dp(15),dp(15));note.setBackground(shape(Color.WHITE));row(page,note,25);
  }
  private void openExternal(String value){
    try{
      Intent i=new Intent(Intent.ACTION_VIEW,Uri.parse(value));
      // TikTok Login Kit requires the external trusted browser, not Android WebView.
      if(getPackageManager().getLaunchIntentForPackage("com.android.chrome")!=null)
        i.setPackage("com.android.chrome");
      openedExternal=true;startActivity(i);
    }catch(Exception error){status.setText("A trusted browser is required to complete official TikTok sign-in.");}
  }
  private static JSONObject request(String action,String id,String secret) throws Exception{
    HttpURLConnection c=(HttpURLConnection)new URL(API).openConnection();
    c.setConnectTimeout(9000);c.setReadTimeout(12000);
    c.setRequestProperty("Accept","application/json");
    c.setRequestProperty("Content-Type","application/json");
    if(action!=null){
      c.setRequestMethod("POST");c.setDoOutput(true);
      JSONObject json=new JSONObject();
      json.put("action",action);json.put("deviceId",id);json.put("deviceToken",secret);
      try(OutputStream out=c.getOutputStream()){out.write(json.toString().getBytes(StandardCharsets.UTF_8));}
    }else c.setRequestMethod("GET");
    int code=c.getResponseCode();
    InputStream stream=code<400?c.getInputStream():c.getErrorStream();
    StringBuilder body=new StringBuilder();
    if(stream!=null)try(BufferedReader b=new BufferedReader(new InputStreamReader(stream,StandardCharsets.UTF_8))){
      String line;while((line=b.readLine())!=null){body.append(line);if(body.length()>16000)throw new Exception("Invalid server response");}
    }
    c.disconnect();
    JSONObject result=new JSONObject(body.toString());
    result.put("_httpStatus",code);
    return result;
  }
  private void run(String task,boolean noAuth){
    if(busy)return;
    busy=true;
    status.setText("Connecting securely to PrimeHub…");
    connect.setEnabled(false);
    new Thread(()->{
      JSONObject result=null;
      try{result=request(noAuth?null:task,deviceId,deviceToken);}
      catch(Exception ignored){}
      final JSONObject response=result;
      ui.post(()->{
        busy=false;if(isFinishing()||isDestroyed())return;
        connect.setEnabled(true);
        if(response==null){status.setText("Network unavailable. Please check internet and retry.");return;}
        if(noAuth){
          loginReady=response.optBoolean("loginKitReady");
          if(deviceId==null||deviceToken==null){
            status.setText("Pair this phone with ChatGPT first.");
            details.setText("Return to PrimeHub Social AI → Pair my phone with ChatGPT. When successfully paired, come back here.");
          }else{
            run("status",false);
          }
          return;
        }
        int http=response.optInt("_httpStatus");
        if(http>=400){
          status.setText(response.optString("error","Account connection unavailable."));
          if(response.optBoolean("setupRequired",false))details.setText(
            "TikTok Developer Login Kit credentials are not configured. TikTok requires its own registered developer app and approved user.info.basic scope; no passwords are collected here.");
          return;
        }
        if("status".equals(task)){
          connected=response.optBoolean("connected",false);
          loginReady=response.optBoolean("officialLoginReady",loginReady);
          status.setText(connected?"✓ TikTok identity verified":"TikTok account not connected");
          details.setText(connected?
            "Officially verified TikTok profile: "+response.optString("displayName","")+
            "\nVerified: "+response.optString("verifiedAt","")+
            "\nIdentity only: ChatGPT does not have access to app screens or posting.":
            "Tap Connect TikTok to use official TikTok Login Kit. The developer connection must be configured first; no third-party passwords are stored.");
          connect.setText(connected?"Switch / verify TikTok account":"🔐 Connect TikTok account");
          disconnect.setEnabled(connected);
        }else if("begin".equals(task)){
          String url=response.optString("authorizeUrl","");
          if(url.startsWith("https://www.tiktok.com/v2/auth/authorize/")){
            status.setText("TikTok official login is opening in Chrome…");
            openExternal(url);
          }else status.setText("Invalid TikTok login URL — blocked.");
        }else if("disconnect".equals(task)){connected=false;refresh();}
      });
    },"PrimeHub-TikTok-Official-OAuth").start();
  }
  private void refresh(){if(deviceId==null||deviceToken==null)run("ready",true);else run("status",false);}
  private void connect(){
    if(deviceId==null||deviceToken==null){
      new AlertDialog.Builder(this).setTitle("Pair your phone first")
        .setMessage("Open the PrimeHub Social AI device pairing screen and pair with your personal ChatGPT connector first.")
        .setPositiveButton("OK",null).show();return;
    }
    // Server strictly refuses to generate a TikTok login URL without Developer Login Kit keys.
    run("begin",false);
  }
}
