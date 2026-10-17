package com.primehub.socialai;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Shows the REAL Android applications that have a launcher activity.
 * This is NOT an OAuth connector. Never reads sessions, UI or credentials.
 */
public final class InstalledAppsActivity extends Activity {
    static final String PREFS = "primehub-social-native-1";
    static final String INSTALLED_KEY = "installed_packages";
    private final ArrayList<Item> all = new ArrayList<>();
    private final ArrayList<Item> shown = new ArrayList<>();
    private ArrayAdapter<Item> adapter;
    private PackageManager pm;
    private SharedPreferences prefs;
    private int dp(int n) { return (int)(n * getResources().getDisplayMetrics().density + .5f); }

    static final class Item {
        final String name;
        final String pkg;
        Item(String name, String pkg) { this.name = name; this.pkg = pkg; }
        @Override public String toString() { return name; }
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(23, 43, 53));
        pm = getPackageManager();
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        buildList();

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setBackgroundColor(Color.rgb(248, 250, 249));
        page.setPadding(dp(17), dp(20), dp(17), dp(12));
        setContentView(page);
        TextView kicker = new TextView(this);
        kicker.setText("✦  PRIMEHUB SOCIAL AI");
        kicker.setTextColor(Color.rgb(89, 129, 63));
        kicker.setTypeface(null, Typeface.BOLD);
        kicker.setTextSize(11);
        page.addView(kicker);
        TextView title = new TextView(this);
        title.setText("Add an installed app");
        title.setTextColor(Color.rgb(20, 41, 53));
        title.setTypeface(null, Typeface.BOLD);
        title.setTextSize(27);
        page.addView(title);
        TextView sub = new TextView(this);
        sub.setText("Select an app already installed on your phone. It will open as the REAL Android application with its own existing login.");
        sub.setTextColor(Color.rgb(101, 119, 125));
        sub.setTextSize(13);
        sub.setPadding(0, dp(8), 0, dp(13));
        page.addView(sub);

        EditText search = new EditText(this);
        search.setSingleLine(true);
        search.setHint("Search your installed apps…");
        search.setTextSize(15);
        search.setPadding(dp(12), dp(8), dp(12), dp(8));
        GradientDrawable field = new GradientDrawable();
        field.setColor(Color.WHITE);
        field.setCornerRadius(dp(12));
        field.setStroke(dp(1), Color.rgb(223, 235, 228));
        search.setBackground(field);
        page.addView(search, new LinearLayout.LayoutParams(-1, dp(48)));

        TextView info = new TextView(this);
        info.setText("These are launch shortcuts, not account integrations. ChatGPT cannot operate other apps without a separate approved connection.");
        info.setTextColor(Color.rgb(118, 134, 138));
        info.setTextSize(11);
        info.setPadding(0, dp(12), 0, dp(10));
        page.addView(info);
        ListView list = new ListView(this);
        list.setDivider(null);
        list.setDividerHeight(dp(5));
        page.addView(list, new LinearLayout.LayoutParams(-1, 0, 1));

        adapter = new ArrayAdapter<Item>(this, android.R.layout.simple_list_item_1, shown) {
            @Override public View getView(int pos, View convertView, ViewGroup parent) {
                Item item = getItem(pos);
                LinearLayout row = new LinearLayout(InstalledAppsActivity.this);
                row.setPadding(dp(10), dp(9), dp(10), dp(9));
                row.setGravity(Gravity.CENTER_VERTICAL);
                GradientDrawable bg = new GradientDrawable();
                bg.setColor(Color.WHITE); bg.setCornerRadius(dp(12));
                bg.setStroke(dp(1), Color.rgb(226, 235, 232));
                row.setBackground(bg);
                ImageView icon = new ImageView(InstalledAppsActivity.this);
                try { icon.setImageDrawable(pm.getApplicationIcon(item.pkg)); }
                catch (PackageManager.NameNotFoundException ignored) { icon.setImageResource(android.R.drawable.sym_def_app_icon); }
                LinearLayout.LayoutParams image = new LinearLayout.LayoutParams(dp(41),dp(41));
                image.rightMargin=dp(12);
                row.addView(icon,image);
                LinearLayout labels = new LinearLayout(InstalledAppsActivity.this);
                labels.setOrientation(LinearLayout.VERTICAL);
                TextView t = new TextView(InstalledAppsActivity.this);
                t.setText(item.name);
                t.setTypeface(null,Typeface.BOLD);t.setTextSize(14);t.setTextColor(Color.rgb(25,43,53));
                TextView p = new TextView(InstalledAppsActivity.this);
                p.setText(item.pkg);p.setTextSize(10);p.setTextColor(Color.rgb(138,151,153));
                labels.addView(t);labels.addView(p);
                row.addView(labels,new LinearLayout.LayoutParams(0,-2,1));
                TextView add = new TextView(InstalledAppsActivity.this);
                add.setText("＋");
                add.setTextSize(23); add.setTextColor(Color.rgb(64,116,57));
                row.addView(add);
                return row;
            }
        };
        list.setAdapter(adapter);
        list.setOnItemClickListener((parent, view, position, id)->addApp(shown.get(position)));
        search.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s,int st,int count,int after) {}
            @Override public void onTextChanged(CharSequence s,int st,int before,int count) {filter(s.toString());}
            @Override public void afterTextChanged(Editable e) {}
        });
        filter("");
    }

    private void buildList() {
        Intent launcher=new Intent(Intent.ACTION_MAIN);
        launcher.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> result=pm.queryIntentActivities(launcher,0);
        Set<String> unique=new HashSet<>();
        for(ResolveInfo ri:result) {
            if(ri.activityInfo==null || ri.activityInfo.packageName==null)continue;
            String pkg=ri.activityInfo.packageName;
            if(pkg.equals(getPackageName())||!unique.add(pkg))continue;
            CharSequence label=ri.loadLabel(pm);
            all.add(new Item(label==null?pkg:label.toString(),pkg));
        }
        all.sort(Comparator.comparing(a->a.name.toLowerCase(java.util.Locale.ROOT)));
    }
    private void filter(String q) {
        shown.clear();
        String needle=q.toLowerCase(java.util.Locale.ROOT).trim();
        for(Item item:all) {
            if(needle.isEmpty()||item.name.toLowerCase(java.util.Locale.ROOT).contains(needle)||
               item.pkg.toLowerCase(java.util.Locale.ROOT).contains(needle))shown.add(item);
        }
        adapter.notifyDataSetChanged();
    }
    private void addApp(Item item) {
        Set<String> saved=new HashSet<>(prefs.getStringSet(INSTALLED_KEY,java.util.Collections.emptySet()));
        if(!saved.add(item.pkg)) {
            Toast.makeText(this,item.name+" already added",Toast.LENGTH_SHORT).show();
            finish();
            return;
        }
        if(saved.size()>100) {
            Toast.makeText(this,"Maximum 100 shortcuts",Toast.LENGTH_SHORT).show();
            return;
        }
        prefs.edit().putStringSet(INSTALLED_KEY,saved).apply();
        Toast.makeText(this,item.name+" added — opens the original Android app",Toast.LENGTH_LONG).show();
        finish();
    }
}