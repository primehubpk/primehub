package com.primehub.socialai;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.hardware.display.DisplayManager;
import android.os.Bundle;
import android.os.IBinder;
import android.os.RemoteException;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import rikka.shizuku.Shizuku;

/**
 * Owner-only connection and read-only virtual-workspace *compatibility probe*.
 * This is not an active virtual display. The real TikTok/phone UI remains untouched.
 */
public final class ShizukuSetupActivity extends Activity {
    private static final int REQUEST_CODE=6107;
    private static final int INK=Color.rgb(24,42,53);
    private TextView status;
    private TextView diagnostic;
    private Button connect;
    private boolean binderRegistered=false;
    private boolean bound=false;
    private IShizukuProbe probe;
    private Shizuku.UserServiceArgs args;

    private final Shizuku.OnBinderReceivedListener arrived=this::refresh;
    private final Shizuku.OnBinderDeadListener departed=this::refresh;
    private final Shizuku.OnRequestPermissionResultListener permissionResult=(code,grantResult)->{
        if(code!=REQUEST_CODE)return;
        refresh();
        if(grantResult==PackageManager.PERMISSION_GRANTED)runProbe();
    };
    private final ServiceConnection connection=new ServiceConnection(){
        @Override public void onServiceConnected(ComponentName name,IBinder binder){
            probe=IShizukuProbe.Stub.asInterface(binder);
            if(isFinishing()||isDestroyed())return;
            diagnostic.setText("Connected to owner-approved Shizuku service. Checking shell identity...");
            new Thread(()->{
                String result;
                try{
                    int uid=probe.getEffectiveUid();
                    String displays=probe.inspectDisplayService();
                    result="Privileged service UID: "+uid+
                      (uid==2000?" (ADB shell)":" (not standard ADB shell)")+
                      "\n\n"+displays;
                }catch(RemoteException|RuntimeException e){
                    result="Shizuku diagnostic failed: "+e.getClass().getSimpleName();
                }
                final String message=result;
                runOnUiThread(()->{
                    if(!isFinishing()&&!isDestroyed())diagnostic.setText(message);
                });
            },"primehub-shizuku-readonly-probe").start();
        }
        @Override public void onServiceDisconnected(ComponentName name){
            probe=null; if(!isFinishing()&&!isDestroyed())diagnostic.setText("Shizuku service disconnected; reopen when running.");
        }
    };

    private int dp(int n){return Math.round(getResources().getDisplayMetrics().density*n);}
    private TextView txt(String value,int size,boolean bold){
        TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(INK);
        if(bold)t.setTypeface(null,Typeface.BOLD);return t;
    }
    private GradientDrawable background(boolean green){
        GradientDrawable d=new GradientDrawable();d.setColor(green?0xffd9f3bd:Color.WHITE);
        d.setCornerRadius(dp(15));return d;
    }
    private Button button(String label,boolean primary,LinearLayout column,View.OnClickListener click){
        Button b=new Button(this);b.setAllCaps(false);b.setText(label);
        b.setTextColor(INK);b.setTextSize(14);b.setBackground(background(primary));
        b.setMinHeight(dp(52));b.setOnClickListener(click);
        LinearLayout.LayoutParams params=new LinearLayout.LayoutParams(-1,-2);params.topMargin=dp(11);
        column.addView(b,params);return b;
    }
    private void add(LinearLayout col,View v,int top){
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.topMargin=dp(top);col.addView(v,lp);
    }
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        getWindow().setStatusBarColor(INK);
        ScrollView scroll=new ScrollView(this);scroll.setBackgroundColor(0xfff8faf7);
        LinearLayout p=new LinearLayout(this);p.setOrientation(LinearLayout.VERTICAL);
        p.setPadding(dp(19),dp(30),dp(19),dp(32));scroll.addView(p);setContentView(scroll);
        add(p,txt("✦ PRIMEHUB SOCIAL AI · PRIVATE",12,true),0);
        add(p,txt("Virtual Workspace",29,true),13);
        add(p,txt("Stage 1: connect to Shizuku 13.5 and check whether your Redmi exposes the necessary privileged display APIs. This check does not create a virtual screen, switch accounts, change phone settings or touch TikTok.",14,false),13);
        status=txt("",16,true);status.setBackground(background(false));
        status.setPadding(dp(18),dp(19),dp(18),dp(19));add(p,status,22);
        connect=button("Allow PrimeHub Social AI in Shizuku",true,p,v->authorize());
        button("↻ Check Shizuku & display compatibility",true,p,v->runProbe());
        button("↗ Open Shizuku settings",false,p,v->{
            Intent launch=getPackageManager().getLaunchIntentForPackage("moe.shizuku.privileged.api");
            if(launch!=null)startActivity(launch);
            else new AlertDialog.Builder(this).setMessage("Please install the official Shizuku app first.").setPositiveButton("OK",null).show();
        });
        diagnostic=txt("The first diagnostic runs only after you authorize the PrimeHub app in Shizuku.",13,false);
        diagnostic.setBackground(background(false));diagnostic.setTextIsSelectable(true);
        diagnostic.setPadding(dp(16),dp(17),dp(16),dp(17));add(p,diagnostic,19);
        TextView limits=txt("PRIVACY AND NEXT STEP\n\n"+
          "• Only Shizuku connection status and local display capabilities are inspected.\n"+
          "• No screenshots, TikTok passwords, private messages or account data are accessed.\n"+
          "• Your phone's main screen stays untouched during this diagnostic.\n"+
          "• You can revoke access in Shizuku → Authorized apps at any time.\n"+
          "• Virtual display creation, target-app launching, AI control and posting are NOT implemented yet.\n"+
          "• This screen checks whether those native capabilities can be built safely for this Redmi/HyperOS version.",12,false);
        limits.setPadding(dp(15),dp(16),dp(15),dp(16));limits.setBackground(background(false));
        add(p,limits,22);
        button("← Back to PrimeHub Social AI",false,p,v->finish());
        args=new Shizuku.UserServiceArgs(new ComponentName(this,ShizukuProbeService.class))
            .daemon(false).tag("primehub-owner-readonly-display-probe-v1").processNameSuffix("display_probe").version(1);
        try{
            Shizuku.addBinderReceivedListenerSticky(arrived);
            Shizuku.addBinderDeadListener(departed);
            Shizuku.addRequestPermissionResultListener(permissionResult);
            binderRegistered=true;
        }catch(RuntimeException e){diagnostic.setText("Unable to attach Shizuku listener: "+e.getClass().getSimpleName());}
        refresh();
    }
    private void refresh(){
        if(status==null||isFinishing()||isDestroyed())return;
        boolean alive;
        try{alive=Shizuku.pingBinder();}catch(Throwable t){alive=false;}
        final boolean running=alive;
        boolean authorized=false;
        int uid=-1;
        if(running){
            try{authorized=Shizuku.checkSelfPermission()==PackageManager.PERMISSION_GRANTED;
                uid=Shizuku.getUid();}
            catch(Throwable ignored){}
        }
        boolean secondary=getPackageManager().hasSystemFeature(
           PackageManager.FEATURE_ACTIVITIES_ON_SECONDARY_DISPLAYS);
        int displays=-1;
        try{DisplayManager manager=(DisplayManager)getSystemService(DISPLAY_SERVICE);
            displays=manager.getDisplays().length;
        }catch(Exception ignored){}
        status.setText("Shizuku server: "+(running?"✓ RUNNING":"NOT CONNECTED")+
          "\nPrimeHub authorization: "+(authorized?"✓ GRANTED":"Not yet granted")+
          "\nShizuku UID: "+(uid<0?"unknown":String.valueOf(uid))+
          "\nAndroid secondary-display feature: "+(secondary?"advertised":"not advertised")+
          "\nCurrently visible displays: "+(displays<0?"unknown":String.valueOf(displays)));
        connect.setEnabled(running&&!authorized);
        connect.setAlpha(running&&!authorized?1f:0.6f);
    }
    private void authorize(){
        if(!Shizuku.pingBinder()){
            diagnostic.setText("Shizuku is not running. Start it from the Shizuku app first.");return;
        }
        try{
            if(Shizuku.checkSelfPermission()==PackageManager.PERMISSION_GRANTED){refresh();return;}
            if(Shizuku.shouldShowRequestPermissionRationale()){
                diagnostic.setText("Permission previously denied. Open Shizuku → Authorized apps and review PrimeHub Social AI permissions.");
                return;
            }
            new AlertDialog.Builder(this)
                .setTitle("Authorize local Shizuku diagnostic?")
                .setMessage("Android will ask you to grant PrimeHub Social AI Shizuku access. This diagnostic only checks system privileges/display capabilities. The permission itself is powerful; only approve if you trust the owner-signed PrimeHub Social AI APK. You can revoke it in Shizuku.")
                .setNegativeButton("Cancel",null)
                .setPositiveButton("Continue",(d,w)->Shizuku.requestPermission(REQUEST_CODE))
                .show();
        }catch(Throwable t){diagnostic.setText("Shizuku authorization unavailable: "+t.getClass().getSimpleName());}
    }
    private void runProbe(){
        refresh();
        try{
            if(!Shizuku.pingBinder()){diagnostic.setText("Shizuku is not running.");return;}
            if(Shizuku.checkSelfPermission()!=PackageManager.PERMISSION_GRANTED){
                diagnostic.setText("Tap Allow PrimeHub Social AI in Shizuku first.");
                return;
            }
            if(bound){
                diagnostic.setText("Read-only privileged service is connecting. Please wait.");
                return;
            }
            bound=true;
            diagnostic.setText("Starting read-only Shizuku shell UID check...");
            Shizuku.bindUserService(args,connection);
        }catch(Throwable t){bound=false;diagnostic.setText("Shizuku probe cannot bind: "+t.getClass().getSimpleName());}
    }
    @Override protected void onResume(){super.onResume();refresh();}
    @Override protected void onDestroy(){
        if(binderRegistered){
            try{Shizuku.removeBinderReceivedListener(arrived);}catch(Throwable ignored){}
            try{Shizuku.removeBinderDeadListener(departed);}catch(Throwable ignored){}
            try{Shizuku.removeRequestPermissionResultListener(permissionResult);}catch(Throwable ignored){}
        }
        if(bound&&args!=null){
            try{Shizuku.unbindUserService(args,connection,true);}catch(Throwable ignored){}
        }
        bound=false;probe=null;
        super.onDestroy();
    }
}
