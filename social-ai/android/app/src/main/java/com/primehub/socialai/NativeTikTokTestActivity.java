package com.primehub.socialai;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Consent screen: launch installed TikTok, optionally test a ONE-TIME safe
 * Create/Upload entry click after the owner approves. No AI remote control.
 */
public final class NativeTikTokTestActivity extends Activity {
    private static final String TIKTOK="com.zhiliaoapp.musically";
    private static final String PREFS="primehub-owner-native-tiktok-test-v1";
    private static final int INK=Color.rgb(24,43,53);
    private TextView status;
    private int dp(int px){return Math.round(px*getResources().getDisplayMetrics().density);}
    private GradientDrawable bg(int color){
        GradientDrawable d=new GradientDrawable();
        d.setColor(color);d.setCornerRadius(dp(13));return d;
    }
    private TextView text(String body,int sp,boolean bold){
        TextView t=new TextView(this);t.setText(body);t.setTextSize(sp);t.setTextColor(INK);
        if(bold)t.setTypeface(null,Typeface.BOLD);return t;
    }
    private Button button(String caption,boolean primary){
        Button b=new Button(this);b.setText(caption);b.setAllCaps(false);
        b.setTextColor(INK);b.setTextSize(13);
        b.setBackground(bg(primary?0xffd4f1ac:Color.WHITE));
        b.setMinHeight(dp(48));return b;
    }
    private void row(LinearLayout col,android.view.View v,int top){
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
        lp.topMargin=dp(top);col.addView(v,lp);
    }
    @Override public void onCreate(Bundle state){
        super.onCreate(state);getWindow().setStatusBarColor(INK);
        ScrollView sc=new ScrollView(this);sc.setBackgroundColor(0xfff7faf8);
        LinearLayout col=new LinearLayout(this);col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(dp(20),dp(28),dp(20),dp(32));sc.addView(col);setContentView(sc);
        row(col,text("✦ PRIMEHUB SOCIAL AI · PRIVATE",12,true),0);
        row(col,text("Control test · real TikTok app",26,true),18);
        row(col,text("Your own signed-in TikTok app will open. Your existing account stays logged in there. For the optional navigation test, Android requires a manual Accessibility permission.",14,false),12);

        status=text("Checking device…",14,true);status.setBackground(bg(Color.WHITE));
        status.setPadding(dp(16),dp(18),dp(16),dp(18));row(col,status,22);
        Button open=button("① Open my real TikTok",true);
        open.setOnClickListener(v->openTikTok());
        row(col,open,20);
        Button permission=button("② Enable optional local navigation test",false);
        permission.setOnClickListener(v->new AlertDialog.Builder(this)
          .setTitle("Android Accessibility permission")
          .setMessage("Optional: Android can grant this app access to on-screen UI. For this TEST, PrimeHub Social AI will only observe TikTok's buttons and may click Create or Upload once after you personally approve. It will NOT read password fields, capture screenshots, upload screen data, publish posts, or accept remote AI commands. Disable the permission anytime in Android Settings. Continue?")
          .setNegativeButton("Cancel",null)
          .setPositiveButton("Open Android Settings",(d,w)->{
              startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
          }).show());
        row(col,permission,9);
        Button local=button("③ Test one safe Create / Upload tap",true);
        local.setOnClickListener(v->{
            if(!OwnerTikTokService.isActive()){
                Toast.makeText(this,"Enable the optional service in Android Accessibility settings first.",Toast.LENGTH_LONG).show();refresh();return;
            }
            new AlertDialog.Builder(this)
              .setTitle("Run ONE local TikTok navigation test?")
              .setMessage("You approve one tap on TikTok's visible Create or Upload entry only. PrimeHub will open TikTok and try within 8 seconds. This NEVER taps Next, Post, Publish or Submit. It does not give ChatGPT remote device control.")
              .setNegativeButton("Cancel",null)
              .setPositiveButton("Approve and open TikTok",(d,w)->{
                  if(!OwnerTikTokService.armOneOwnerApprovedClick()){
                      status.setText("Accessibility service is offline; no tap scheduled.");return;
                  }
                  openTikTok();
              }).show();
        });row(col,local,9);
        Button check=button("↻ Check test result",false);
        check.setOnClickListener(v->refresh());row(col,check,9);
        Button back=button("← Back to PrimeHub Social AI",false);
        back.setOnClickListener(v->finish());row(col,back,9);
        TextView notice=text("WHAT THIS TEST PROVES\n\n✓ Your original TikTok app retains its own signed-in sessions.\n✓ With explicit Android permission and owner approval, local code can observe safe UI elements and request a click.\n✕ No remote AI click/vision channel is connected yet.\n✕ No account credentials, private messages or screenshots are read or transmitted.\n✕ No automatic posting. Platform UI and Android restrictions may prevent some clicks.\n\nYou can disable the accessibility service in Android Settings → Accessibility.",12,false);
        notice.setBackground(bg(Color.WHITE));notice.setPadding(dp(15),dp(18),dp(15),dp(18));
        row(col,notice,23);
        refresh();
    }
    @Override protected void onResume(){super.onResume();refresh();}
    private void refresh(){
        if(status==null)return;
        SharedPreferences p=getSharedPreferences(PREFS,MODE_PRIVATE);
        boolean ready=OwnerTikTokService.isActive();
        String last=p.getString("last_action","No test run yet.");
        status.setText((ready?"✓ Optional service is enabled":"Optional service not enabled")+
          "\nLast test: "+last);
    }
    private void openTikTok(){
        Intent intent=getPackageManager().getLaunchIntentForPackage(TIKTOK);
        if(intent==null){
            status.setText("Real TikTok app is not installed or not launchable.");return;
        }
        try{startActivity(intent);}
        catch(Exception e){status.setText("Could not open real TikTok app.");}
    }
}
