package com.primehub.socialai;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
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
import java.security.SecureRandom;
import java.util.UUID;

/**
 * PrimeHub owner-only device pairing.
 *
 * Only pairs, revokes and reports a foreground heartbeat.
 * No remote UI control, Accessibility, screen capture or credential reading.
 * The owner's 26-character secret is never automatically sent to third-party apps.
 */
public final class PairDeviceActivity extends Activity {
    private static final String ENDPOINT =
        "https://primehub-social-ai-primehubmall.vercel.app/api/pair";
    private static final String PREFS="primehub-social-owner-pairing-v1";
    private static final char[] BASE32="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".toCharArray();
    private final SecureRandom random = new SecureRandom();
    private final Handler handler=new Handler(Looper.getMainLooper());
    private static final int INK=Color.rgb(24,42,53);
    private SharedPreferences prefs;
    private TextView codeView,statusView;
    private boolean busy=false,foreground=false;
    private String deviceId,deviceToken,pairCode;
    private final Runnable pulse=new Runnable(){
        @Override public void run(){
            if(!foreground)return;
            if(!busy && deviceId!=null && deviceToken!=null)heartbeat();
            handler.postDelayed(this,60_000L);
        }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(INK);
        prefs=getSharedPreferences(PREFS,MODE_PRIVATE);
        deviceId=prefs.getString("id",null);
        deviceToken=prefs.getString("secret",null);
        pairCode=prefs.getString("code",null);
        if(deviceId==null||deviceToken==null||pairCode==null)createNewCredentials();
        show();
    }
    @Override protected void onResume(){
        super.onResume();foreground=true;
        handler.removeCallbacks(pulse);
        handler.postDelayed(pulse,3500L);
    }
    @Override protected void onPause(){
        handler.removeCallbacks(pulse);
        foreground=false;super.onPause();
    }
    private static String makeBase32(SecureRandom random,int count){
        byte[] bytes=new byte[17];
        random.nextBytes(bytes);
        StringBuilder code=new StringBuilder();
        for(int i=0;i<count;i++){
            int value=0;
            for(int bit=0;bit<5;bit++){
                int off=i*5+bit;
                int set=(bytes[off/8]>>(7-off%8))&1;
                value=(value<<1)|set;
            }
            code.append(BASE32[value]);
        }
        return code.toString();
    }
    private void createNewCredentials(){
        byte[] b=new byte[32];random.nextBytes(b);
        StringBuilder hex=new StringBuilder(64);
        for(byte x:b)hex.append(String.format(java.util.Locale.ROOT,"%02x",x&255));
        deviceId=UUID.randomUUID().toString();
        deviceToken=hex.toString();
        pairCode=makeBase32(random,26);
        prefs.edit().putString("id",deviceId).putString("secret",deviceToken)
            .putString("code",pairCode).putBoolean("registered",false).apply();
    }
    private int dp(int x){return Math.round(getResources().getDisplayMetrics().density*x);}
    private GradientDrawable bg(int color){
        GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(13));return d;
    }
    private TextView text(String value,int size,boolean bold){
        TextView t=new TextView(this);t.setText(value);t.setTextSize(size);
        t.setTextColor(INK);if(bold)t.setTypeface(null,Typeface.BOLD);return t;
    }
    private Button button(String label,int color){
        Button b=new Button(this);
        b.setText(label);b.setAllCaps(false);
        b.setBackground(bg(color));b.setTextColor(INK);b.setTextSize(13);
        b.setMinHeight(dp(48));return b;
    }
    private void show(){
        ScrollView scroll=new ScrollView(this);
        scroll.setBackgroundColor(0xfff6f9f6);
        LinearLayout page=new LinearLayout(this);
        page.setPadding(dp(19),dp(27),dp(19),dp(35));
        page.setOrientation(LinearLayout.VERTICAL);scroll.addView(page);setContentView(scroll);

        TextView eyebrow=text("✦ PRIMEHUB SOCIAL AI · PRIVATE",12,true);
        eyebrow.setTextColor(0xff548346);page.addView(eyebrow);
        TextView title=text("Pair this Android phone.",28,true);
        LinearLayout.LayoutParams top=new LinearLayout.LayoutParams(-1,-2);top.topMargin=dp(15);
        page.addView(title,top);
        TextView description=text("Keep this screen open during pairing. Only you choose whether to share this secret with your personal ChatGPT connector.",13,false);
        description.setTextColor(0xff62757d);
        LinearLayout.LayoutParams para=new LinearLayout.LayoutParams(-1,-2);para.topMargin=dp(10);
        page.addView(description,para);

        TextView label=text("PRIVATE OWNER PAIRING CODE",11,true);
        LinearLayout.LayoutParams sec=new LinearLayout.LayoutParams(-1,-2);sec.topMargin=dp(25);
        page.addView(label,sec);
        codeView=text(pairCode,23,true);
        codeView.setTextIsSelectable(true);
        codeView.setGravity(Gravity.CENTER);
        codeView.setPadding(dp(6),dp(22),dp(6),dp(22));
        codeView.setBackground(bg(Color.WHITE));
        LinearLayout.LayoutParams box=new LinearLayout.LayoutParams(-1,-2);box.topMargin=dp(10);
        page.addView(codeView,box);
        TextView warning=text("Treat this like a password: whoever has it can check your pairing status. Never publish it or send it to strangers. You can revoke it at any time.",12,false);
        warning.setTextColor(0xff946d44);page.addView(warning,para);
        Button copy=button("Copy pairing code",0xffd2f2ac);
        copy.setOnClickListener(v->{
            ClipboardManager clip=(ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE);
            clip.setPrimaryClip(ClipData.newPlainText("PrimeHub owner pairing code",pairCode));
            toast("Pairing code copied. Paste only into your personal ChatGPT conversation.");
        });
        page.addView(copy,box);

        statusView=text("Status: checking…",13,true);
        statusView.setTextIsSelectable(true);
        page.addView(statusView,sec);

        Button connect=button("① Start secure pairing (15 minutes)",0xffd2f2ac);
        connect.setOnClickListener(v->begin());
        page.addView(connect,box);
        Button check=button("② Check connection",Color.WHITE);
        check.setOnClickListener(v->heartbeat());
        page.addView(check,box);
        Button reset=button("Change pairing code",Color.WHITE);
        reset.setOnClickListener(v->new AlertDialog.Builder(this)
            .setTitle("Rotate your owner code?")
            .setMessage("This disconnects the previous ChatGPT pairing code. Start pairing again and use the newly generated secret.")
            .setNegativeButton("Cancel",null)
            .setPositiveButton("Rotate",(d,w)->revokeThenRotate()).show());
        page.addView(reset,box);
        Button disconnect=button("Revoke device and pairing",0xffffeeee);
        disconnect.setOnClickListener(v->new AlertDialog.Builder(this)
            .setTitle("Revoke access?")
            .setMessage("This permanently invalidates the current owner code in our pairing database. It does not uninstall any social applications or remove their logins.")
            .setNegativeButton("Cancel",null)
            .setPositiveButton("Revoke",(d,w)->revokeThenRotate()).show());
        page.addView(disconnect,box);
        Button back=button("← Back to my apps",Color.WHITE);
        back.setOnClickListener(v->finish());page.addView(back,box);

        TextView limits=text("✓ Real server pairing check.\n✓ Device heartbeats only while this screen is open.\n✕ No unattended posting or remote control of TikTok, Maps, Instagram or the phone.\n✕ ChatGPT cannot read your screen, passwords, cookies or other apps from this connection.",12,false);
        limits.setPadding(dp(15),dp(15),dp(15),dp(15));
        limits.setBackground(bg(Color.WHITE));page.addView(limits,sec);
        if(prefs.getBoolean("registered",false))heartbeat();
        else statusView.setText("Not connected. Tap Start secure pairing, then give your code to ChatGPT.");
    }
    private void toast(String s){Toast.makeText(this,s,Toast.LENGTH_LONG).show();}
    private interface Success {void finished(JSONObject data);}
    private void invoke(String action,String id,String secret,String code,Success onSuccess){
        if(busy)return;
        busy=true;statusView.setText("Contacting private pairing server…");
        new Thread(()->{
            JSONObject result=null;String error=null;
            try{
                HttpURLConnection connection=(HttpURLConnection)new URL(ENDPOINT).openConnection();
                connection.setConnectTimeout(8000);connection.setReadTimeout(10000);
                connection.setRequestMethod("POST");connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type","application/json");
                JSONObject body=new JSONObject();
                body.put("action",action);
                body.put("deviceId",id);
                body.put("deviceToken",secret);
                if(code!=null)body.put("code",code);
                try(OutputStream out=connection.getOutputStream()){
                    out.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }
                int status=connection.getResponseCode();
                InputStream input=status<400?connection.getInputStream():connection.getErrorStream();
                StringBuilder data=new StringBuilder();
                if(input!=null)try(BufferedReader reader=new BufferedReader(new InputStreamReader(input,StandardCharsets.UTF_8))){
                    String line;while((line=reader.readLine())!=null)data.append(line);
                }
                connection.disconnect();
                JSONObject wrapped=new JSONObject(data.toString());
                if(status>=400||!wrapped.optBoolean("ok",false))
                    error=wrapped.optString("error","Connection rejected.");
                else result=wrapped.optJSONObject("result");
            }catch(Exception ex){error="Network unavailable. Check your internet connection and try again.";}
            final String msg=error;
            final JSONObject data=result;
            runOnUiThread(()->{
                busy=false;
                if(isFinishing()||isDestroyed())return;
                if(msg!=null){statusView.setText("Connection problem: "+msg);return;}
                onSuccess.finished(data==null?new JSONObject():data);
            });
        },"PrimeHub-Pair-HTTPS").start();
    }
    private void begin(){
        invoke("begin",deviceId,deviceToken,pairCode,data->{
            if(data.optBoolean("registered",false)){
                prefs.edit().putBoolean("registered",true).apply();
                statusView.setText("Pairing open for 15 minutes. Tell ChatGPT to pair using the copied owner code.");
                toast("Pairing registered. Complete it from your private ChatGPT.");
            }else statusView.setText("Pairing registration failed.");
        });
    }
    private void heartbeat(){
        if(!prefs.getBoolean("registered",false)){
            statusView.setText("Not connected. Tap Start pairing.");return;
        }
        invoke("heartbeat",deviceId,deviceToken,null,data->{
            if(!data.optBoolean("authorized",false)){
                statusView.setText("Device is not registered. Start pairing again.");
                prefs.edit().putBoolean("registered",false).apply();return;
            }
            statusView.setText(data.optBoolean("paired",false)?
              "✓ PAIRED with your private ChatGPT code. Foreground heartbeat active.":
              "Waiting for owner approval in ChatGPT. Code expires after 15 minutes.");
        });
    }
    private void revokeThenRotate(){
        if(!prefs.getBoolean("registered",false)){
            createNewCredentials();show();return;
        }
        invoke("revoke",deviceId,deviceToken,null,data->{
            if(!data.optBoolean("revoked",false)){
                statusView.setText("Could not revoke. Please retry while online.");return;
            }
            createNewCredentials();show();
            toast("Old code revoked. Generate a new pairing code when needed.");
        });
    }
}
