package com.primehub.socialai;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Owner-initiated, 15-minute supervised TikTok-only AI navigation window.
 * Shares NO cookies/passwords, no screen pixels, no message contents.
 * Other apps, signing-in, texting, payments and publishing are not supported.
 */
public final class LiveAgentActivity extends Activity {
    public static final String PREFS="primehub-owner-android-agent-v1";
    private static final String PAIR="primehub-social-owner-pairing-v1";
    public static final String API="https://primehub-social-ai-primehubmall.vercel.app/api/android-agent";
    private static final String ALPHABET="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final Handler main=new Handler(Looper.getMainLooper());
    private TextView details;
    private Button startButton;
    private boolean busy=false;
    private SharedPreferences agent, pairing;
    private static final int INK=Color.rgb(24,42,53);
    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
    private TextView text(String s,int size,boolean bold){
        TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(INK);
        if(bold)t.setTypeface(null,Typeface.BOLD);return t;
    }
    private GradientDrawable bg(int color){
        GradientDrawable d=new GradientDrawable();
        d.setColor(color);d.setCornerRadius(dp(14));return d;
    }
    private Button button(String s,boolean green){
        Button b=new Button(this);b.setText(s);b.setAllCaps(false);
        b.setTextSize(14);b.setTextColor(INK);b.setBackground(bg(green?0xffd9f5b5:Color.WHITE));
        b.setMinHeight(dp(50));return b;
    }
    private void add(LinearLayout p,android.view.View v,int mt){
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.topMargin=dp(mt);p.addView(v,lp);
    }
    @Override public void onCreate(Bundle state){
        super.onCreate(state);getWindow().setStatusBarColor(INK);
        agent=getSharedPreferences(PREFS,MODE_PRIVATE);
        pairing=getSharedPreferences(PAIR,MODE_PRIVATE);
        ScrollView sc=new ScrollView(this);sc.setBackgroundColor(0xfff7faf7);
        LinearLayout p=new LinearLayout(this);p.setOrientation(LinearLayout.VERTICAL);
        p.setPadding(dp(19),dp(26),dp(19),dp(30));sc.addView(p);setContentView(sc);
        add(p,text("✦ PRIMEHUB SOCIAL AI · OWNER-ONLY",12,true),0);
        add(p,text("AI navigation session",29,true),15);
        add(p,text("Approve ONE temporary 15-minute TikTok navigation session. ChatGPT can inspect limited visible UI labels and request safe navigation taps or scrolling without individual hard-coded button scripts.",14,false),13);
        details=text("",15,true);details.setPadding(dp(17),dp(18),dp(17),dp(18));
        details.setBackground(bg(Color.WHITE));details.setTextIsSelectable(true);add(p,details,25);
        startButton=button("🔐 Start 15-minute AI navigation",true);
        startButton.setOnClickListener(v->confirmStart());add(p,startButton,17);
        Button copy=button("Copy NEW session code to private ChatGPT",false);
        copy.setOnClickListener(v->{
            String code=agent.getString("code","");
            if(!sessionActive()||code.isEmpty()){details.setText("Start a new session first.");return;}
            ClipboardManager cm=(ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE);
            cm.setPrimaryClip(ClipData.newPlainText("PrimeHub owner session (keep private)",code));
            details.setText("Private session code copied. Send it ONLY to your personal ChatGPT. It expires in 15 minutes.");
        });add(p,copy,8);
        Button open=button("↗ Open my real TikTok",true);open.setOnClickListener(v->{
            Intent intent=getPackageManager().getLaunchIntentForPackage("com.zhiliaoapp.musically");
            if(intent!=null)startActivity(intent);
            else details.setText("TikTok is not available on this phone.");
        });add(p,open,8);
        Button stop=button("⛔ Stop and revoke AI session",false);
        stop.setOnClickListener(v->confirmStop());add(p,stop,9);
        Button back=button("← Back to PrimeHub Social AI",false);
        back.setOnClickListener(v->finish());add(p,back,9);
        TextView limits=text("IMPORTANT PRIVACY LIMITS\n\n"+
            "✓ Only your TikTok app's visible button/navigation labels are shared during the session.\n"+
            "✓ Android Accessibility permission remains owner-controlled.\n"+
            "✓ Your account stays logged in inside TikTok itself; cookies and passwords are never extracted.\n"+
            "✓ You can stop the AI session instantly.\n"+
            "✕ No TikTok videos, screen pixels or sounds can be viewed by ChatGPT in this version.\n"+
            "✕ No final Post, Send, Publish, Delete, Like, Follow, payment, account switching or text-entry commands.\n"+
            "✕ ChatGPT cannot control Android once this time-limited session ends.\n\n"+
            "The code is a temporary secret. Anyone who has it while a session is active could attempt low-risk navigation. Do not put the code in public screenshots or messages.",12,false);
        limits.setPadding(dp(15),dp(18),dp(15),dp(18));limits.setBackground(bg(Color.WHITE));add(p,limits,25);
        showState();
    }
    public static boolean sessionActive(SharedPreferences p){
        return p.getLong("until",0)>System.currentTimeMillis()&&p.getBoolean("enabled",false);
    }
    private boolean sessionActive(){return sessionActive(agent);}
    @Override protected void onResume(){super.onResume();showState();}
    @Override protected void onDestroy(){io.shutdownNow();super.onDestroy();}
    private void showState(){
        if(details==null)return;
        long remaining=(agent.getLong("until",0)-System.currentTimeMillis())/60000;
        if(sessionActive())details.setText("✓ Session approved and active\n"+
          "Remaining: about "+Math.max(1,remaining)+" minutes\n"+
          "Open TikTok, then share your one-time session code privately with ChatGPT.");
        else details.setText("No live AI session.\nTap Start only when you want ChatGPT to inspect TikTok's visible navigation controls.");
    }
    private void confirmStart(){
        if(busy)return;
        if(!OwnerTikTokService.isActive()){
            new AlertDialog.Builder(this).setTitle("Accessibility not enabled")
                .setMessage("Please enable the optional PrimeHub Social AI TikTok owner test accessibility service in Android Settings first.")
                .setPositiveButton("OK",null).show();return;
        }
        if(pairing.getString("id",null)==null||pairing.getString("secret",null)==null){
            new AlertDialog.Builder(this).setTitle("Pair this phone first")
                .setMessage("Use PrimeHub Social AI → Pair my phone with ChatGPT before starting a live navigation session.")
                .setPositiveButton("OK",null).show();return;
        }
        new AlertDialog.Builder(this).setTitle("Approve 15 minutes of TikTok navigation?")
          .setMessage("ChatGPT will be able to inspect limited TikTok button labels and request low-risk navigation (tap/scroll/back). It CANNOT watch videos, read DMs, upload, publish, change settings, send messages, or enter passwords. Do not share your temporary code publicly. You can stop the session anytime.")
          .setNegativeButton("Cancel",null)
          .setPositiveButton("Approve session",(d,w)->begin()).show();
    }
    private String generateCode(){
        byte[] bytes=new byte[26];new SecureRandom().nextBytes(bytes);
        StringBuilder code=new StringBuilder();
        for(byte v:bytes)code.append(ALPHABET.charAt((v&255)%ALPHABET.length()));
        return code.toString();
    }
    private void begin(){
        String code=generateCode();
        JSONObject input=new JSONObject();
        try{
            input.put("action","start");
            input.put("deviceId",pairing.getString("id",""));
            input.put("deviceToken",pairing.getString("secret",""));
            input.put("sessionCode",code);
            input.put("durationSeconds",900);
        }catch(Exception ignored){}
        busy=true;startButton.setEnabled(false);
        details.setText("Registering private 15-minute Android session…");
        io.execute(()->{
            JSONObject r=request(input);
            main.post(()->{
                if(isFinishing()||isDestroyed())return;
                busy=false;startButton.setEnabled(true);
                if(r!=null&&r.optBoolean("started",false)){
                    agent.edit().putString("code",code)
                      .putBoolean("enabled",true)
                      .putLong("until",System.currentTimeMillis()+900000L).apply();
                    showState();
                    new AlertDialog.Builder(this).setTitle("AI navigation session is ready")
                      .setMessage("Open the real TikTok app, then copy the NEW session code and send it to your personal ChatGPT. This gives temporary button-navigation access only, not account posting or screen/video capture.")
                      .setPositiveButton("OK",null).show();
                }else details.setText("Could not start session. Confirm that this phone is still paired with your personal ChatGPT and try again.");
            });
        });
    }
    private void confirmStop(){
        new AlertDialog.Builder(this).setTitle("Stop the live AI session?")
          .setMessage("This revokes the temporary code and blocks queued navigation actions.")
          .setNegativeButton("Cancel",null)
          .setPositiveButton("Stop session",(d,w)->stopSession()).show();
    }
    private void stopSession(){
        if(busy)return;
        agent.edit().putBoolean("enabled",false).remove("code").putLong("until",0).apply();
        showState();
        JSONObject data=new JSONObject();
        try{
          data.put("action","stop");
          data.put("deviceId",pairing.getString("id",""));
          data.put("deviceToken",pairing.getString("secret",""));
        }catch(Exception ignored){}
        io.execute(()->{
            JSONObject r=request(data);
            main.post(()->{
              if(!isFinishing()&&!isDestroyed())details.setText(r!=null&&r.optBoolean("stopped",false)?
                "✓ Session revoked and stopped.":"Local session stopped. Server revocation could not be verified; the code will expire automatically.");
            });
        });
    }
    public static JSONObject request(JSONObject body){
        try{
            HttpURLConnection c=(HttpURLConnection)new URL(API).openConnection();
            c.setConnectTimeout(8500);c.setReadTimeout(10000);
            c.setRequestMethod("POST");c.setDoOutput(true);
            c.setRequestProperty("Content-Type","application/json");
            c.setRequestProperty("Accept","application/json");
            try(OutputStream o=c.getOutputStream()){
                o.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            if(c.getResponseCode()!=200){c.disconnect();return null;}
            StringBuilder b=new StringBuilder();
            try(InputStream stream=c.getInputStream();
                BufferedReader reader=new BufferedReader(new InputStreamReader(stream,StandardCharsets.UTF_8))){
                String ln;
                while((ln=reader.readLine())!=null){
                    b.append(ln);if(b.length()>17000){c.disconnect();return null;}
                }
            }finally{c.disconnect();}
            return new JSONObject(b.toString());
        }catch(Exception ignored){return null;}
    }
}
