package com.primehub.socialai;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.util.DisplayMetrics;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Generic owner-approved dynamic TikTok accessibility navigation agent.
 * Bounded UI metadata only: no passwords, screenshots, messages, video/audio,
 * account sessions or text-entry. Completely disabled outside a local 15min session.
 * Remote actions use exact owner-observed labels; dangerous labels are blocked.
 */
public final class AndroidAgentRuntime {
    private static final String TIKTOK="com.zhiliaoapp.musically";
    private static final String PAIR="primehub-social-owner-pairing-v1";
    private static final String PREFS=LiveAgentActivity.PREFS;
    private final OwnerTikTokService service;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private volatile boolean closed=false;
    private volatile boolean busy=false;
    private volatile int revision=0;
    private String lastSnapshot="";
    private long lastPush=0;
    private long lastEvent=0;
    private final Runnable tick=new Runnable(){
        @Override public void run(){
            if(closed)return;
            collectAndPoll();
            main.postDelayed(this,2800);
        }
    };
    public AndroidAgentRuntime(OwnerTikTokService owner){
        service=owner;
        main.postDelayed(tick,1500);
    }
    public void onEvent(AccessibilityEvent event){
        if(closed||event==null||event.getPackageName()==null ||
            !TIKTOK.contentEquals(event.getPackageName()))return;
        lastEvent=SystemClock.elapsedRealtime();
    }
    public void stop(){
        closed=true;main.removeCallbacks(tick);io.shutdownNow();
    }
    private boolean enabled(){
        SharedPreferences p=service.getSharedPreferences(PREFS,AccessibilityService.MODE_PRIVATE);
        return LiveAgentActivity.sessionActive(p);
    }
    private boolean tiktokForeground(){
        AccessibilityNodeInfo root=service.getRootInActiveWindow();
        return root!=null && root.getPackageName()!=null &&
           TIKTOK.contentEquals(root.getPackageName());
    }
    private void collectAndPoll(){
        if(!enabled()||busy||!tiktokForeground())return;
        AccessibilityNodeInfo root=service.getRootInActiveWindow();
        if(root==null)return;
        final JSONObject snapshot=new JSONObject();
        try{
            snapshot.put("package",TIKTOK);
            snapshot.put("elements",extract(root));
        }catch(Exception ignored){return;}
        final String value=snapshot.toString();
        if(value.length()>8500)return;
        final long now=SystemClock.elapsedRealtime();
        final boolean shouldPush=!value.equals(lastSnapshot)||now-lastPush>10500;
        busy=true;
        io.execute(()->{
            try{
                final String id=service.getSharedPreferences(PAIR,AccessibilityService.MODE_PRIVATE).getString("id","");
                final String token=service.getSharedPreferences(PAIR,AccessibilityService.MODE_PRIVATE).getString("secret","");
                if(id.length()!=36||token.length()!=64)return;
                if(shouldPush){
                    JSONObject payload=buildRequest("push",id,token);
                    payload.put("snapshot",snapshot);
                    JSONObject out=LiveAgentActivity.request(payload);
                    if(out==null||!out.optBoolean("ok",false))return;
                    revision=out.optInt("revision",revision);
                    lastSnapshot=value;lastPush=SystemClock.elapsedRealtime();
                }
                JSONObject poll=LiveAgentActivity.request(buildRequest("poll",id,token));
                if(poll==null||!poll.optBoolean("active",false))return;
                JSONObject action=poll.optJSONObject("action");
                if(action==null)return;
                final String commandId=action.optString("id","");
                final String operation=action.optString("operation","");
                final String label=action.optString("label","");
                final int expected=action.optInt("expected_revision",-1);
                if(commandId.length()!=36)return;
                main.post(()->executeAction(commandId,operation,label,expected,id,token));
            }catch(Exception ignored){
            }finally{busy=false;}
        });
    }
    private JSONObject buildRequest(String action,String id,String token) throws Exception{
        JSONObject body=new JSONObject();
        body.put("action",action);body.put("deviceId",id);body.put("deviceToken",token);
        return body;
    }
    private JSONArray extract(AccessibilityNodeInfo root){
        JSONArray elements=new JSONArray();
        collect(root,elements,0);
        return elements;
    }
    private void collect(AccessibilityNodeInfo node,JSONArray arr,int depth){
        if(node==null||depth>15||arr.length()>=80||node.isPassword())return;
        CharSequence cls=node.getClassName();
        if(cls!=null&&cls.toString().toLowerCase(Locale.ROOT).contains("edittext"))return;
        if(node.isVisibleToUser()&&node.isEnabled() && node.isClickable()){
            String label=label(node);
            if(!label.isEmpty()&&label.length()<=65 && !looksSensitive(label)){
                JSONObject el=new JSONObject();
                try{
                    el.put("label",label);
                    el.put("clickable",true);
                    el.put("role",cls==null?"view":cls.toString().replace("android.widget.",""));
                    arr.put(el);
                }catch(Exception ignored){}
            }
        }
        for(int i=0;i<Math.min(45,node.getChildCount())&&arr.length()<80;i++)
            collect(node.getChild(i),arr,depth+1);
    }
    private String label(AccessibilityNodeInfo node){
        CharSequence text=node.getContentDescription();
        if(text==null||text.length()==0)text=node.getText();
        return text==null?"":text.toString().trim().replaceAll("[\\r\\n\\t]+"," ");
    }
    private boolean looksSensitive(String value){
        String x=value.toLowerCase(Locale.ROOT);
        return x.contains("password")||x.contains("one-time password")||x.contains("verification code")||
           x.contains("otp")||x.matches(".*[0-9]{7,}.*")||
           (value.indexOf('@')>=0&&value.contains("."));
    }
    private boolean blockedActionLabel(String label){
        if(label==null||label.isEmpty()||label.length()>65)return true;
        String s=" "+label.toLowerCase(Locale.ROOT)+" ";
        return s.matches(".*\\b(post|publish|send|delete|confirm|pay|purchase|buy|withdraw|logout|block|report|follow|like|reply|comment|message|share|promote|sign out)\\b.*")||
          looksSensitive(label);
    }
    private AccessibilityNodeInfo findExact(AccessibilityNodeInfo node,String label,int depth){
        if(node==null||depth>15||node.isPassword())return null;
        CharSequence cls=node.getClassName();
        if(cls!=null&&cls.toString().toLowerCase(Locale.ROOT).contains("edittext"))return null;
        if(node.isVisibleToUser()&&node.isClickable()&&node.isEnabled()&&label.equals(label(node)))
            return node;
        for(int i=0;i<Math.min(45,node.getChildCount());i++){
            AccessibilityNodeInfo r=findExact(node.getChild(i),label,depth+1);
            if(r!=null)return r;
        }
        return null;
    }
    private AccessibilityNodeInfo findScroll(AccessibilityNodeInfo node,int depth){
        if(node==null||depth>15)return null;
        if(node.isVisibleToUser()&&node.isScrollable()&&node.isEnabled())return node;
        for(int i=0;i<Math.min(45,node.getChildCount());i++){
            AccessibilityNodeInfo r=findScroll(node.getChild(i),depth+1);
            if(r!=null)return r;
        }
        return null;
    }
    private void executeAction(String cmd,String operation,String label,int expected,String id,String token){
        boolean ok=false;String message="Action rejected";
        if(!enabled()||!tiktokForeground()){
            message="TikTok must be visible during active owner-approved session";
        }else if(expected!=revision){
            message="Screen revision changed; inspect again";
        }else{
            AccessibilityNodeInfo root=service.getRootInActiveWindow();
            if(root==null){message="TikTok UI unavailable";}
            else if("tap_label".equals(operation)){
                if(blockedActionLabel(label)){message="Sensitive action blocked";}
                else{
                    AccessibilityNodeInfo node=findExact(root,label,0);
                    if(node==null)message="Label changed or is no longer visible";
                    else{ok=node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                      message=ok?"Tapped requested visible navigation label":"TikTok refused tap";}
                }
            }else if("scroll_forward".equals(operation)||"scroll_backward".equals(operation)){
                AccessibilityNodeInfo scroll=findScroll(root,0);
                if(scroll==null){
                    // TikTok's feed frequently has no accessibility scrollable node.
                    // Only fixed, one-page vertical owner-authorized swipes are supported.
                    ok=swipeFeed(operation.equals("scroll_forward"));
                    message=ok?"Requested one safe TikTok feed swipe":"TikTok refused bounded feed swipe";
                }else{
                    int dir=operation.equals("scroll_forward")?
                      AccessibilityNodeInfo.ACTION_SCROLL_FORWARD:AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD;
                    ok=scroll.performAction(dir);
                    message=ok?"Scrolled visible TikTok content":"TikTok refused scroll";
                }
            }else if("back".equals(operation)){
                ok=service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK);
                message=ok?"Navigated back":"Back was not available";
            }
        }
        final boolean succeeded=ok;final String outcome=message;
        io.execute(()->{
            try{
                JSONObject receipt=buildRequest("complete",id,token);
                receipt.put("commandId",cmd);
                receipt.put("succeeded",succeeded);
                receipt.put("message",outcome);
                LiveAgentActivity.request(receipt);
            }catch(Exception ignored){}
        });
    }
    private boolean swipeFeed(boolean forward){
        if(!enabled()||!tiktokForeground())return false;
        DisplayMetrics size=service.getResources().getDisplayMetrics();
        int width=size.widthPixels,height=size.heightPixels;
        if(width<150||height<400)return false;
        float center=width*0.5f;
        Path path=new Path();
        path.moveTo(center,height*(forward?0.76f:0.27f));
        path.lineTo(center,height*(forward?0.27f:0.76f));
        GestureDescription gesture=new GestureDescription.Builder()
           .addStroke(new GestureDescription.StrokeDescription(path,0,420)).build();
        return service.dispatchGesture(gesture,null,null);
    }

}
