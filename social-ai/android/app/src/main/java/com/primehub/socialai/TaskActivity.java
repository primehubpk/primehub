package com.primehub.socialai;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.TimePickerDialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.DateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Owner-approved handoff inbox. Incoming links are untrusted proposals:
 * never automatically open URLs or publish after receiving an Intent.
 */
public final class TaskActivity extends Activity {
    static final String PREFS = "primehub-social-tasks-v1";
    static final String CHANNEL = "primehub-social-reminders";
    private static final int INK = Color.rgb(24,42,53);
    private static final int LIGHT = Color.rgb(247,250,246);
    private static final int ACCENT = Color.rgb(199,245,132);
    private static final String[] PLATFORMS = {"Facebook","Instagram","TikTok","YouTube","Google Business"};
    private static final String[] LINKS = {
        "https://www.facebook.com/",
        "https://www.instagram.com/",
        "https://www.tiktok.com/tiktokstudio",
        "https://studio.youtube.com/",
        "https://business.google.com/"
    };
    private LinearLayout page;
    private final ArrayList<JSONObject> tasks = new ArrayList<>();
    private SharedPreferences prefs;

    static int platformIndex(String platform) {
        if (platform == null) return -1;
        String trimmed = platform.trim();
        for (int i=0;i<PLATFORMS.length;i++) {
            if (PLATFORMS[i].equalsIgnoreCase(trimmed)) return i;
        }
        return -1;
    }
    static boolean isValidImport(Uri uri) {
        if (uri==null || !"primehubsocial".equalsIgnoreCase(uri.getScheme()) ||
            !"import".equalsIgnoreCase(uri.getHost()) || uri.toString().length()>4300) return false;
        String title=uri.getQueryParameter("title");
        String caption=uri.getQueryParameter("caption");
        String platform=uri.getQueryParameter("platform");
        String date=uri.getQueryParameter("at");
        if(title==null || title.trim().isEmpty() || title.length()>100 ||
           caption==null || caption.trim().isEmpty() || caption.length()>2400 ||
           platformIndex(platform)<0) return false;
        if(date!=null && !date.isEmpty()){
            try {
                long parsed=Long.parseLong(date);
                if(parsed<0 || parsed > System.currentTimeMillis()+366L*86400000L) return false;
            } catch(NumberFormatException ex){return false;}
        }
        return true;
    }

    @Override public void onCreate(Bundle bundle){
        super.onCreate(bundle);
        getWindow().setStatusBarColor(INK);
        prefs=getSharedPreferences(PREFS,MODE_PRIVATE);
        loadTasks();
        setupNotifications();
        showTasks();
        handleIncoming(getIntent());
    }
    @Override protected void onNewIntent(Intent intent){
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncoming(intent);
    }
    private void handleIncoming(Intent intent){
        if(intent==null || !Intent.ACTION_VIEW.equals(intent.getAction()))return;
        Uri data=intent.getData();
        if(!isValidImport(data)){
            new AlertDialog.Builder(this).setTitle("Invalid handoff")
                .setMessage("This link cannot be imported. No action was performed.")
                .setPositiveButton("OK",null).show();
            return;
        }
        String title=data.getQueryParameter("title").trim();
        String caption=data.getQueryParameter("caption").trim();
        int platform=platformIndex(data.getQueryParameter("platform"));
        long at=0;
        try {at=Long.parseLong(data.getQueryParameter("at"));}catch(Exception ignored){}
        final long when=at;
        String text="From an external link — approval required.\n\n"+title+
            "\nPlatform: "+PLATFORMS[platform]+"\n\n"+caption+
            (when>0?"\n\nReminder: "+DateFormat.getDateTimeInstance().format(new Date(when)):"");
        new AlertDialog.Builder(this)
            .setTitle("Review AI-prepared post")
            .setMessage(text)
            .setNegativeButton("Reject",null)
            .setPositiveButton("Save to my tasks",(d,w)->{
                saveNewTask(title,caption,platform,when);
                Toast.makeText(this,"Approved task saved locally. Nothing was published.",Toast.LENGTH_LONG).show();
            }).show();
    }

    private void setupNotifications(){
        if(Build.VERSION.SDK_INT>=26){
            NotificationChannel channel=new NotificationChannel(CHANNEL,
                "PrimeHub Social AI post reminders",NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Reminds you to publish approved content manually.");
            ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
        }
    }
    private void loadTasks(){
        tasks.clear();
        try {
            JSONArray arr=new JSONArray(prefs.getString("tasks","[]"));
            for(int i=0;i<Math.min(500,arr.length());i++){
                JSONObject obj=arr.optJSONObject(i);
                if(obj!=null && obj.optString("title","").length()>0 && platformIndex(obj.optString("platform"))>=0)tasks.add(obj);
            }
        }catch(Exception ignored){}
    }
    private void persist(){
        JSONArray arr=new JSONArray();
        for(JSONObject obj:tasks)arr.put(obj);
        prefs.edit().putString("tasks",arr.toString()).apply();
    }
    private static JSONObject makeTask(String title,String caption,int platform,long at){
        JSONObject obj=new JSONObject();
        try {
            obj.put("id",System.currentTimeMillis()+"-"+(int)(Math.random()*999999));
            obj.put("title",title);
            obj.put("caption",caption);
            obj.put("platform",PLATFORMS[platform]);
            obj.put("at",at);
            obj.put("done",false);
            obj.put("created",System.currentTimeMillis());
        }catch(Exception ignored){}
        return obj;
    }
    private void saveNewTask(String title,String caption,int platform,long at){
        if(tasks.size()>=500){toast("Maximum 500 tasks saved. Please remove old ones.");return;}
        JSONObject obj=makeTask(title,caption,platform,at);
        tasks.add(0,obj);persist();schedule(this,obj);askNotificationPermission();showTasks();
    }
    static void schedule(Context context,JSONObject obj){
        long at=obj.optLong("at",0);
        if(at<=System.currentTimeMillis() || obj.optBoolean("done"))return;
        Intent intent=new Intent(context,ReminderReceiver.class);
        intent.putExtra("title",obj.optString("title","Post ready"));
        intent.putExtra("id",obj.optString("id"));
        int id=obj.optString("id").hashCode();
        PendingIntent pending=PendingIntent.getBroadcast(context,id,intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager alarm=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
        if(alarm!=null) {
            // Inexact: Android battery policies may delay reminders.
            alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pending);
        }
    }
    static void cancel(Context context,JSONObject obj){
        Intent intent=new Intent(context,ReminderReceiver.class);
        PendingIntent pending=PendingIntent.getBroadcast(context,obj.optString("id").hashCode(),intent,
            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
        if(pending!=null){
            AlarmManager alarm=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
            if(alarm!=null)alarm.cancel(pending);
            pending.cancel();
        }
    }
    private void askNotificationPermission(){
        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},67);
        }
    }
    private void toast(String s){Toast.makeText(this,s,Toast.LENGTH_LONG).show();}
    private int dp(int x){return Math.round(x*getResources().getDisplayMetrics().density);}
    private GradientDrawable bg(int color,int border){
        GradientDrawable d=new GradientDrawable();
        d.setColor(color);d.setCornerRadius(dp(13));
        if(border!=0)d.setStroke(dp(1),border);
        return d;
    }
    private TextView label(String s,int size,boolean bold){
        TextView t=new TextView(this);t.setText(s);t.setTextColor(INK);t.setTextSize(size);
        if(bold)t.setTypeface(null,Typeface.BOLD);return t;
    }
    private Button button(String title,boolean primary){
        Button b=new Button(this);
        b.setText(title);b.setAllCaps(false);
        b.setTextSize(13);
        b.setTextColor(INK);b.setBackground(bg(primary?ACCENT:Color.WHITE,primary?0:0xffdfebe2));
        return b;
    }
    private LinearLayout.LayoutParams lp(int top){
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);
        p.setMargins(0,dp(top),0,0);return p;
    }
    private void showTasks(){
        ScrollView scroll=new ScrollView(this);
        scroll.setBackgroundColor(LIGHT);
        page=new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(18),dp(20),dp(18),dp(35));
        scroll.addView(page);
        setContentView(scroll);

        TextView badge=label("✦  OWNER-APPROVED CONTENT",11,true);
        badge.setLetterSpacing(.17f);
        page.addView(badge,lp(0));
        page.addView(label("Your AI task inbox.",28,true),lp(11));
        TextView note=label("Create tasks here or approve handoffs sent from ChatGPT. Nothing opens or publishes without your choice.",12,false);
        note.setTextColor(0xff7a8a90);page.addView(note,lp(8));
        Button create=button("＋ Create a task",true);
        create.setOnClickListener(v->showCreate());
        page.addView(create,lp(16));
        Button back=button("← Back to my applications",false);
        back.setOnClickListener(v->finish());
        page.addView(back,lp(8));

        TextView heading=label("Saved tasks · "+tasks.size(),19,true);
        page.addView(heading,lp(24));
        if(tasks.isEmpty()){
            TextView blank=label("No tasks yet.\n\nTap Create a task or import a post from the PrimeHub web studio.",13,false);
            blank.setPadding(dp(18),dp(25),dp(18),dp(25));
            blank.setBackground(bg(Color.WHITE,0xffe5ece8));
            page.addView(blank,lp(12));return;
        }
        for(JSONObject item:new ArrayList<>(tasks))renderTask(item);
    }

    private void renderTask(JSONObject task){
        LinearLayout card=new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(14),dp(15),dp(14),dp(15));
        card.setBackground(bg(Color.WHITE,0xffe5ebe7));
        String title=task.optString("title","Untitled task");
        int idx=platformIndex(task.optString("platform"));
        String channel=idx<0?"Unknown":PLATFORMS[idx];
        boolean done=task.optBoolean("done",false);
        card.addView(label(title,16,true));
        String meta=channel+" • "+(done?"Marked as published":"Manual publication pending");
        long date=task.optLong("at",0);
        if(date>0)meta+="\nReminder: "+DateFormat.getDateTimeInstance().format(new Date(date));
        TextView subt=label(meta,11,false);
        subt.setTextColor(0xff73848c);card.addView(subt,lp(7));
        TextView cap=label(task.optString("caption"),12,false);
        cap.setMaxLines(4);card.addView(cap,lp(12));
        Button publish=button("✎ Prepare & open "+channel,false);
        publish.setOnClickListener(v->showPublish(task));
        card.addView(publish,lp(12));
        LinearLayout row=new LinearLayout(this);
        Button doneBtn=button(done?"↶ Mark pending":"✓ Mark published",true);
        row.addView(doneBtn,new LinearLayout.LayoutParams(0,dp(45),1));
        doneBtn.setOnClickListener(v->{
            try{task.put("done",!done);}catch(Exception ignored){}
            if(!done)cancel(this,task);
            else schedule(this,task);
            persist();showTasks();
        });
        Button del=button("Delete",false);
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,dp(45),.6f);
        p.leftMargin=dp(8);row.addView(del,p);
        del.setOnClickListener(v->new AlertDialog.Builder(this).setTitle("Delete this task?")
            .setMessage("This task is saved only on this device.")
            .setNegativeButton("Cancel",null)
            .setPositiveButton("Delete",(dialog,which)->{
                cancel(this,task);tasks.remove(task);persist();showTasks();
            }).show());
        card.addView(row,lp(9));
        page.addView(card,lp(12));
    }

    private void showPublish(JSONObject task){
        int index=platformIndex(task.optString("platform"));
        if(index<0)return;
        String caption=task.optString("caption","");
        String name=PLATFORMS[index], url=LINKS[index];
        new AlertDialog.Builder(this)
            .setTitle("Prepare "+name+" post")
            .setMessage("Step 1: Copy the caption.\nStep 2: Open the official "+name+" publishing page.\nStep 3: Select your product image or video and publish there.\n\nThis application does not post automatically.")
            .setNeutralButton("Copy caption",(d,w)->{
                android.content.ClipboardManager clip=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
                clip.setPrimaryClip(android.content.ClipData.newPlainText("Social post caption",caption));
                toast("Caption copied — open "+name+" to paste it.");
            })
            .setNegativeButton("Cancel",null)
            .setPositiveButton("Open site",(d,w)->{
                Intent i=new Intent(this,MainActivity.class);
                i.setAction("com.primehub.socialai.OPEN_SITE");
                i.putExtra("safe_url",url);
                startActivity(i);
            }).show();
    }

    private void showCreate(){
        LinearLayout form=new LinearLayout(this);form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(dp(20),0,dp(20),0);
        EditText title=new EditText(this);title.setHint("Post title");title.setSingleLine(true);
        title.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        form.addView(title);
        EditText caption=new EditText(this);caption.setHint("Post caption and hashtags");caption.setMinLines(3);
        caption.setMaxLines(7);form.addView(caption);
        final int[] selection={0};
        Button platform=button("Platform: "+PLATFORMS[0]+" ▾",false);
        platform.setOnClickListener(v->new AlertDialog.Builder(this)
            .setTitle("Choose platform")
            .setSingleChoiceItems(PLATFORMS,selection[0],(d,which)->{
                selection[0]=which;platform.setText("Platform: "+PLATFORMS[which]+" ▾");d.dismiss();
            }).setNegativeButton("Cancel",null).show());
        form.addView(platform,lp(8));
        final long[] when={0};
        Button choose=button("Choose reminder date & time (optional)",false);
        choose.setOnClickListener(v->{
            Calendar c=Calendar.getInstance();
            new DatePickerDialog(this,(datePicker,year,month,day)->{
                new TimePickerDialog(this,(picker,hour,minute)->{
                    Calendar pick=Calendar.getInstance();
                    pick.set(year,month,day,hour,minute,0);
                    when[0]=pick.getTimeInMillis();
                    choose.setText(DateFormat.getDateTimeInstance().format(new Date(when[0])));
                },c.get(Calendar.HOUR_OF_DAY),c.get(Calendar.MINUTE),false).show();
            },c.get(Calendar.YEAR),c.get(Calendar.MONTH),c.get(Calendar.DAY_OF_MONTH)).show();
        });
        form.addView(choose,lp(8));
        ScrollView scroll=new ScrollView(this);scroll.addView(form);
        AlertDialog d=new AlertDialog.Builder(this).setTitle("Create a post task")
            .setView(scroll).setNegativeButton("Cancel",null).setPositiveButton("Save",null).create();
        d.setOnShowListener(v->d.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view->{
            String t=title.getText().toString().trim(),c=caption.getText().toString().trim();
            if(t.isEmpty()||t.length()>100){title.setError("Title required (max 100 characters)");return;}
            if(c.isEmpty()||c.length()>2400){caption.setError("Caption required (max 2400 characters)");return;}
            if(when[0]>0 && when[0]<System.currentTimeMillis()){toast("Choose a future reminder time.");return;}
            saveNewTask(t,c,selection[0],when[0]);d.dismiss();
        }));
        d.show();
    }

    public static final class ReminderReceiver extends BroadcastReceiver{
        @Override public void onReceive(Context context,Intent intent){
            String title=intent.getStringExtra("title");
            if(title==null)return;
            if(Build.VERSION.SDK_INT>=33 &&
                context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
            NotificationManager mgr=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
            if(Build.VERSION.SDK_INT>=26){
                NotificationChannel ch=new NotificationChannel(CHANNEL,"PrimeHub Social AI reminders",NotificationManager.IMPORTANCE_DEFAULT);
                mgr.createNotificationChannel(ch);
            }
            Intent open=new Intent(context,TaskActivity.class);
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pi=PendingIntent.getActivity(context,23243,open,PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification.Builder builder=Build.VERSION.SDK_INT>=26?
                new Notification.Builder(context,CHANNEL):new Notification.Builder(context);
            Notification note=builder.setContentTitle("PrimeHub Social AI — publish reminder")
                .setContentText(title+" · Review and publish manually.")
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setAutoCancel(true).setContentIntent(pi).build();
            mgr.notify((int)(System.currentTimeMillis() % Integer.MAX_VALUE),note);
        }
    }
    public static final class BootReceiver extends BroadcastReceiver {
        @Override public void onReceive(Context context,Intent intent){
            String action=intent.getAction();
            if(!Intent.ACTION_BOOT_COMPLETED.equals(action) &&
               !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action))return;
            try{
                SharedPreferences prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
                JSONArray saved=new JSONArray(prefs.getString("tasks","[]"));
                for(int i=0;i<Math.min(saved.length(),500);i++){
                    JSONObject row=saved.optJSONObject(i);
                    if(row!=null)schedule(context,row);
                }
            }catch(Exception ignored){}
        }
    }
}
