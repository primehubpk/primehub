package com.primehub.socialai;

import android.accessibilityservice.AccessibilityService;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.Locale;

/**
 * Owner-assisted TikTok foreground local test ONLY.
 *
 * - Listens ONLY to TikTok's own package events.
 * - No remote commands, network requests, screenshots, clipboard or sensitive text read.
 * - NEVER reads EditText, password widgets, typed credentials, login codes or captions.
 * - Will click ONLY owner-approved "Create"/"Upload" UI entry button, ONCE,
 *   within 8 seconds of the owner's explicit in-app confirmation.
 * - Publishing buttons, account switching, payments and deletions are forbidden.
 *
 * A future MCP/device-agent may NOT directly invoke this service: it needs
 * a distinct, secure and user-confirmed action protocol with revocation.
 */
public final class OwnerTikTokService extends AccessibilityService {
    private static final String TIKTOK="com.zhiliaoapp.musically";
    private static final String PREFS="primehub-owner-native-tiktok-test-v1";
    private static volatile OwnerTikTokService active;
    private static volatile long armedUntil=0;
    private static volatile boolean armed=false;
    private static volatile long lastProcessed=0;

    public static boolean isActive(){return active!=null;}
    public static synchronized boolean armOneOwnerApprovedClick(){
        if(active==null)return false;
        armed=true;
        armedUntil=SystemClock.elapsedRealtime()+8000;
        return true;
    }
    private static synchronized boolean consumeArmedClick(){
        if(!armed || SystemClock.elapsedRealtime()>armedUntil){
            armed=false;return false;
        }
        armed=false;return true;
    }
    private static synchronized boolean isArmed(){
        if(SystemClock.elapsedRealtime()>armedUntil)armed=false;
        return armed;
    }
    @Override protected void onServiceConnected(){
        active=this;
        getSharedPreferences(PREFS,MODE_PRIVATE).edit()
          .putString("last_action","Service ready. Only manual TikTok test supported.").apply();
    }
    @Override public void onAccessibilityEvent(AccessibilityEvent event){
        if(event==null||event.getPackageName()==null
                ||!TIKTOK.contentEquals(event.getPackageName()))return;
        long now=SystemClock.elapsedRealtime();
        if(now-lastProcessed<200 || !isArmed())return;
        lastProcessed=now;
        AccessibilityNodeInfo root=getRootInActiveWindow();
        if(root==null || root.getPackageName()==null
            ||!TIKTOK.contentEquals(root.getPackageName()))return;
        // Only precisely defined safe UI navigation labels.
        AccessibilityNodeInfo action=findSafeEntry(root,0);
        if(action==null)return;
        if(!consumeArmedClick())return;
        boolean succeeded=action.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        SharedPreferences prefs=getSharedPreferences(PREFS,MODE_PRIVATE);
        prefs.edit().putString("last_action",succeeded?
          "Manual TikTok Create/Upload navigation click succeeded.":
          "TikTok did not expose an actionable Create/Upload button. Nothing was posted.")
          .putLong("last_action_time",System.currentTimeMillis()).apply();
    }
    private AccessibilityNodeInfo findSafeEntry(AccessibilityNodeInfo node,int depth){
        if(node==null||depth>18||node.isPassword())return null;
        CharSequence cls=node.getClassName();
        // Do not inspect any input widget text. Only button/navigation labels.
        if(cls!=null&&cls.toString().toLowerCase(Locale.ROOT).contains("edittext"))
            return null;
        if(node.isClickable()&&node.isVisibleToUser()&&node.isEnabled()){
            CharSequence cd=node.getContentDescription();
            CharSequence tx=node.getText();
            if(isEntry(cd)||isEntry(tx))return node;
        }
        for(int i=0;i<Math.min(60,node.getChildCount());i++){
            AccessibilityNodeInfo found=findSafeEntry(node.getChild(i),depth+1);
            if(found!=null)return found;
        }
        return null;
    }
    private boolean isEntry(CharSequence chars){
        if(chars==null)return false;
        String value=chars.toString().trim().toLowerCase(Locale.ROOT);
        // Never match "Post", "Publish", "Next", login, follow, delete, send or buy.
        return value.equals("create")||value.equals("upload")
            ||value.equals("create video")||value.equals("upload video")
            ||value.equals("add video")||value.equals("create post");
    }
    @Override public void onInterrupt(){
        synchronized(OwnerTikTokService.class){armed=false;}
    }
    @Override public void onDestroy(){
        if(active==this)active=null;
        synchronized(OwnerTikTokService.class){armed=false;}
        super.onDestroy();
    }
}