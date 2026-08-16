package org.iblokz.scopedfolder;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "ScopedFolder",
    permissions = {
        @Permission(
            alias = "publicStorage",
            strings = {
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            }
        )
    }
)
public class ScopedFolderPlugin extends Plugin {
    private static final String TAG = "ScopedFolder";
    private ScopedFolder impl;

    @Override
    public void load() {
        impl = new ScopedFolder(getContext());
        Log.i(TAG, "ScopedFolder plugin loaded");
    }

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Log.i(TAG, "pickFolder called");
        // On API 33+ SAF does not need legacy storage permission. On older APIs,
        // request it first so DocumentsUI can show shared volumes.
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.S_V2
            && getPermissionState("publicStorage") != com.getcapacitor.PermissionState.GRANTED) {
            Log.i(TAG, "Requesting publicStorage permission before picker");
            requestPermissionForAlias("publicStorage", call, "storagePermsCallback");
            return;
        }
        launchFolderPicker(call);
    }

    @PermissionCallback
    private void storagePermsCallback(PluginCall call) {
        // Proceed even if denied — SAF can still grant a specific tree.
        Log.i(TAG, "storage permission result: " + getPermissionState("publicStorage"));
        launchFolderPicker(call);
    }

    private void launchFolderPicker(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No activity available for folder picker");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        );
        Log.i(TAG, "Launching ACTION_OPEN_DOCUMENT_TREE");
        startActivityForResult(call, intent, "onFolderPicked");
    }

    @SuppressLint("WrongConstant")
    @ActivityCallback
    private void onFolderPicked(PluginCall call, ActivityResult result) {
        if (call == null) {
            Log.w(TAG, "onFolderPicked: call is null");
            return;
        }
        if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            Log.i(TAG, "onFolderPicked: cancelled or empty result");
            call.reject("User cancelled");
            return;
        }

        Intent data = result.getData();
        Uri uri = data.getData();
        if (uri == null) {
            call.reject("No folder URI returned");
            return;
        }

        try {
            getContext()
                .getContentResolver()
                .takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                );
        } catch (SecurityException e) {
            Log.w(TAG, "takePersistableUriPermission failed", e);
        }

        DocumentFile doc = DocumentFile.fromTreeUri(getContext(), uri);
        String name = (doc != null && doc.getName() != null) ? doc.getName() : uri.getLastPathSegment();

        JSObject folder = new JSObject();
        folder.put("id", uri.toString());
        folder.put("name", name != null ? name : "folder");

        Log.i(TAG, "Folder picked: " + name + " → " + uri);
        call.resolve(new JSObject().put("folder", folder));
    }

    @PluginMethod
    public void writeFile(PluginCall call) {
        impl.writeFile(call);
    }

    @PluginMethod
    public void readFile(PluginCall call) {
        impl.readFile(call);
    }

    @PluginMethod
    public void mkdir(PluginCall call) {
        impl.mkdir(call);
    }

    @PluginMethod
    public void readdir(PluginCall call) {
        impl.readdir(call);
    }
}
