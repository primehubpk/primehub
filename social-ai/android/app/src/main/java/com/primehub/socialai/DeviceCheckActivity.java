package com.primehub.socialai;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.PackageInfo;
import android.content.pm.ApplicationInfo;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Button;
import android.widget.ScrollView;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;

import java.util.ArrayList;
import java.util.Set;
import java.util.List;
import java.util.Collections;

/**
 * User-operated read-only device diagnostics.
 *
 * No silent upload, identity harvesting, permissions escalation or session reads.
 * Information only leaves the phone if the owner explicitly taps Share.
 */
public final class DeviceCheckActivity extends Activity {
    private static final String PREFS="primehub-social-native-1";
    private static final int INK=Color.rgb(23,42,53);
    private static final int ACCENT=Color.rgb(210,244,161);
    private TextView reportText;
    private String report;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(INK);
        show();
    }
    private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
    private TextView text(String s,int sp,boolean bold){
        TextView v=new TextView(this);
        v.setText(s);v.setTextSize(sp);v.setTextColor(INK);
        if(bold)v.setTypeface(null,Typeface.BOLD);
        return v;
    }
    private GradientDrawable background(int fill){
        GradientDrawable b=new GradientDrawable();
        b.setColor(fill);b.setCornerRadius(dp(13));return b;
    }
    private Button button(String s){
        Button b=new Button(this);b.setText(s);b.setAllCaps(false);
        b.setTextColor(INK);b.setTextSize(14);b.setBackground(background(ACCENT));
        return b;
    }

    private String createReport(){
        StringBuilder b=new StringBuilder();
        b.append("PrimeHub Social AI — Owner Device Check\n");
        b.append("Report generated: ").append(new java.util.Date()).append("\n\n");
        b.append("Android version: ").append(Build.VERSION.RELEASE).append(" (API ").append(Build.VERSION.SDK_INT).append(")\n");
        b.append("Manufacturer: ").append(Build.MANUFACTURER).append("\n");
        b.append("Device model: ").append(Build.MODEL).append("\n");
        try {
            PackageInfo self = getPackageManager().getPackageInfo(getPackageName(),0);
            b.append("Social AI app version: ").append(self.versionName).append("\n");
        }catch(PackageManager.NameNotFoundException ignored){}
        try{
            PackageInfo web=WebView.getCurrentWebViewPackage();
            b.append("Android WebView engine: ").append(web==null?"unavailable":web.packageName+" "+web.versionName).append("\n");
        }catch(Exception ignored){}
        b.append("Native app launcher installed: YES\n");
        b.append("Android AI Tasks inbox: YES\n");
        b.append("MCP handoff: Link-only. No live device pairing.\n");
        b.append("Remote ChatGPT device control: NOT CONNECTED\n");
        b.append("Automatic third-party app posting: NOT ENABLED\n");
        b.append("App login cookies read or shared: NO\n\n");
        SharedPreferences prefs=getSharedPreferences(PREFS,MODE_PRIVATE);
        Set<String> saved=prefs.getStringSet(InstalledAppsActivity.INSTALLED_KEY,Collections.emptySet());
        List<String> packages=new ArrayList<>(saved);
        Collections.sort(packages);
        b.append("Apps selected in PrimeHub Social AI (").append(packages.size()).append("):\n");
        PackageManager pm=getPackageManager();
        if(packages.isEmpty())b.append(" - None added yet\n");
        for(String pkg:packages){
            try{
                ApplicationInfo info=pm.getApplicationInfo(pkg,0);
                CharSequence label=pm.getApplicationLabel(info);
                boolean launch=pm.getLaunchIntentForPackage(pkg)!=null;
                b.append(" - ").append(label==null?"Unknown":label.toString().replace("\n"," "))
                    .append(" [").append(pkg).append("] | ").append(launch?"Launchable":"Cannot launch").append("\n");
            }catch(PackageManager.NameNotFoundException ex){
                b.append(" - ").append(pkg).append(" | Not visible / possibly uninstalled\n");
            }
        }
        b.append("\nPrivacy: generated locally on your phone. No credentials, customer data,");
        b.append(" account email, phone number, cookies or precise location included.\n");
        b.append("This report is shared ONLY if you explicitly tap Share.");
        return b.toString();
    }
    private void share(){
        new AlertDialog.Builder(this)
            .setTitle("Share device diagnostics?")
            .setMessage("This shares your Android model/version and the names of apps you selected. No passwords or sessions are included. Choose ChatGPT in Android's share sheet if you want me to inspect the report.")
            .setNegativeButton("Cancel",null)
            .setPositiveButton("Share report",(d,w)->{
                Intent share=new Intent(Intent.ACTION_SEND);
                share.setType("text/plain");
                share.putExtra(Intent.EXTRA_SUBJECT,"PrimeHub Social AI — owner device check");
                share.putExtra(Intent.EXTRA_TEXT,report);
                startActivity(Intent.createChooser(share,"Share device check with..."));
            }).show();
    }
    private void show(){
        report=createReport();
        ScrollView scroll=new ScrollView(this);scroll.setBackgroundColor(Color.rgb(247,250,249));
        LinearLayout page=new LinearLayout(this);page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(19),dp(25),dp(19),dp(25));scroll.addView(page);
        setContentView(scroll);
        page.addView(text("✦  PRIVATE DEVICE STATUS",11,true));
        TextView head=text("Check your Android connection.",27,true);
        LinearLayout.LayoutParams top=new LinearLayout.LayoutParams(-1,-2);top.topMargin=dp(15);
        page.addView(head,top);
        TextView desc=text("View real installed-app shortcuts and actual connection limits. Nothing is sent to ChatGPT unless you choose to share the report.",13,false);
        LinearLayout.LayoutParams after=new LinearLayout.LayoutParams(-1,-2);after.topMargin=dp(11);
        page.addView(desc,after);
        reportText=text(report,12,false);
        reportText.setTextIsSelectable(true);
        reportText.setPadding(dp(14),dp(16),dp(14),dp(16));
        reportText.setBackground(background(Color.WHITE));
        page.addView(reportText,after);
        Button share=button("✦ Share this report to ChatGPT");
        share.setOnClickListener(v->share());
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(50));p.topMargin=dp(19);
        page.addView(share,p);
        Button refresh=button("⟳ Refresh device check");
        refresh.setOnClickListener(v->show());
        LinearLayout.LayoutParams p2=new LinearLayout.LayoutParams(-1,dp(50));p2.topMargin=dp(9);
        page.addView(refresh,p2);
        Button back=button("← Back to my applications");
        back.setOnClickListener(v->finish());
        LinearLayout.LayoutParams p3=new LinearLayout.LayoutParams(-1,dp(50));p3.topMargin=dp(9);
        page.addView(back,p3);
    }
}