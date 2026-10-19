package com.primehub.socialai;

import android.os.Process;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

/**
 * Shizuku shell-UID UserService. Runs ONLY when owner requests diagnostics.
 * Exactly one hard-coded read-only diagnostic command is supported. This service
 * cannot launch native apps, take screenshots, enter text or change settings.
 */
public final class ShizukuProbeService extends IShizukuProbe.Stub {
    public ShizukuProbeService() {}

    @Override public int getEffectiveUid() {
        return Process.myUid(); // Expected 2000 for ADB-started Shizuku.
    }

    @Override public String inspectDisplayService() {
        ProcessBuilder pb=new ProcessBuilder("/system/bin/cmd","display","help");
        pb.redirectErrorStream(true);
        java.lang.Process p=null;
        try {
            p=pb.start();
            if(!p.waitFor(5,TimeUnit.SECONDS)) {
                p.destroyForcibly();
                return "Display command timed out.";
            }
            StringBuilder out=new StringBuilder(512);
            try(BufferedReader r=new BufferedReader(new InputStreamReader(p.getInputStream(),StandardCharsets.UTF_8))){
                String line;
                while((line=r.readLine())!=null && out.length()<1500)out.append(line).append('\n');
            }
            return "Display service command available: "+(p.exitValue()==0?"yes":"unknown")+
                "\n"+out.toString().trim();
        }catch(Exception e) {
            return "Display service probe unavailable: "+e.getClass().getSimpleName();
        }finally{if(p!=null)p.destroy();}
    }

    @Override public void destroy(){
        System.exit(0);
    }
}
