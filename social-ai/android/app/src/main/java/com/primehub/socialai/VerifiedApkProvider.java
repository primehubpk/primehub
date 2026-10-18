package com.primehub.socialai;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * Non-exported, read-only provider. Only verified APK file may be read by the
 * Android system installer after a per-URI grant from UpdateActivity.
 */
public final class VerifiedApkProvider extends ContentProvider {
    private File allowed(Uri uri) throws FileNotFoundException {
        if(uri==null||!"/verified-update.apk".equals(uri.getPath())||
            !uri.getAuthority().equals(getContext().getPackageName()+".apkfile"))
            throw new FileNotFoundException("Not an approved update URI.");
        File file=new File(getContext().getCacheDir(),"primehub-social-update.apk");
        if(!file.isFile())throw new FileNotFoundException("No verified update.");
        return file;
    }
    @Override public boolean onCreate(){return true;}
    @Override public String getType(Uri uri){return "application/vnd.android.package-archive";}
    @Override public ParcelFileDescriptor openFile(Uri uri,String mode) throws FileNotFoundException {
        if(!"r".equals(mode))throw new FileNotFoundException("Write operation denied.");
        return ParcelFileDescriptor.open(allowed(uri),ParcelFileDescriptor.MODE_READ_ONLY);
    }
    @Override public Cursor query(Uri uri,String[] projection,String selection,String[] args,String sortOrder){
        try{
            File f=allowed(uri);
            String[] columns=projection!=null?projection:new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE};
            MatrixCursor cursor=new MatrixCursor(columns);
            Object[] vals=new Object[columns.length];
            for(int i=0;i<columns.length;i++){
                if(OpenableColumns.DISPLAY_NAME.equals(columns[i]))vals[i]="primehub-social-ai.apk";
                else if(OpenableColumns.SIZE.equals(columns[i]))vals[i]=f.length();
            }
            cursor.addRow(vals);return cursor;
        }catch(FileNotFoundException ex){return null;}
    }
    @Override public Uri insert(Uri uri,ContentValues values){throw new SecurityException("Read only");}
    @Override public int update(Uri uri,ContentValues values,String sel,String[] args){throw new SecurityException("Read only");}
    @Override public int delete(Uri uri,String sel,String[] args){throw new SecurityException("Read only");}
}
