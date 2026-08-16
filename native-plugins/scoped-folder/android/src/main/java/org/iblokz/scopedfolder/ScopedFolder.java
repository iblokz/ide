package org.iblokz.scopedfolder;

import android.content.Context;
import android.net.Uri;
import android.util.Base64;

import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

public class ScopedFolder {
    private final Context context;

    public ScopedFolder(Context ctx) {
        this.context = ctx.getApplicationContext();
    }

    public void writeFile(PluginCall call) {
        try {
            DocumentFile f = ensureFile(call);
            String data = nonNull(call.getString("data"), "data missing");
            String enc = call.getString("encoding", "utf8");

            byte[] bytes = "base64".equalsIgnoreCase(enc)
                ? Base64.decode(data, Base64.DEFAULT)
                : data.getBytes(StandardCharsets.UTF_8);

            try (OutputStream os = context.getContentResolver().openOutputStream(f.getUri(), "w")) {
                if (os == null) throw new Exception("Failed to open output stream");
                os.write(bytes);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("writeFile failed: " + e.getMessage());
        }
    }

    public void readFile(PluginCall call) {
        try {
            DocumentFile f = resolveFile(call);
            if (f == null || !f.isFile()) {
                call.reject("File not found");
                return;
            }

            try (InputStream is = context.getContentResolver().openInputStream(f.getUri())) {
                if (is == null) throw new Exception("Failed to open input stream");
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n;
                while ((n = is.read(buf)) != -1) buffer.write(buf, 0, n);

                String enc = call.getString("encoding", "utf8");
                JSObject ret = new JSObject();
                if ("base64".equalsIgnoreCase(enc)) {
                    ret.put("data", Base64.encodeToString(buffer.toByteArray(), Base64.NO_WRAP));
                } else {
                    ret.put("data", new String(buffer.toByteArray(), StandardCharsets.UTF_8));
                }
                call.resolve(ret);
            }
        } catch (Exception e) {
            call.reject("readFile failed: " + e.getMessage());
        }
    }

    public void mkdir(PluginCall call) {
        try {
            String[] parts = splitPath(getPath(call));
            DocumentFile cur = requireBase(call);

            for (String p : parts) {
                DocumentFile next = cur.findFile(p);
                if (next == null) {
                    next = cur.createDirectory(p);
                    if (next == null) throw new Exception("Failed to create directory: " + p);
                }
                cur = next;
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("mkdir failed: " + e.getMessage());
        }
    }

    public void readdir(PluginCall call) {
        try {
            String path = call.getString("path", "");
            DocumentFile dir;
            if (path == null || path.trim().isEmpty()) {
                dir = requireBase(call);
            } else {
                dir = resolveFile(call);
            }
            if (dir == null || !dir.isDirectory()) {
                call.reject("Not a directory");
                return;
            }
            JSArray arr = new JSArray();
            for (DocumentFile f : dir.listFiles()) {
                String name = f.getName();
                if (name == null) continue;
                JSObject entry = new JSObject();
                entry.put("name", name);
                entry.put("isDir", f.isDirectory());
                if (f.isFile()) {
                    entry.put("size", f.length());
                }
                if (f.lastModified() > 0) {
                    entry.put("mtime", f.lastModified() / 1000.0);
                }
                arr.put(entry);
            }
            call.resolve(new JSObject().put("entries", arr));
        } catch (Exception e) {
            call.reject("readdir failed: " + e.getMessage());
        }
    }

    private String getFolderId(PluginCall call) throws Exception {
        JSObject folder = call.getObject("folder");
        if (folder == null) throw new Exception("'folder' missing");
        String id = folder.getString("id");
        if (id == null || id.isEmpty()) throw new Exception("'folder.id' missing");
        return id;
    }

    private String getPath(PluginCall call) throws Exception {
        String p = call.getString("path");
        if (p == null || p.trim().isEmpty()) throw new Exception("'path' missing");
        return p;
    }

    private DocumentFile requireBase(PluginCall call) throws Exception {
        Uri tree = Uri.parse(getFolderId(call));
        DocumentFile base = DocumentFile.fromTreeUri(context, tree);
        if (base == null) throw new Exception("Invalid folder URI");
        return base;
    }

    private DocumentFile resolveFile(PluginCall call) {
        try {
            String path = getPath(call);
            DocumentFile cur = requireBase(call);
            for (String seg : splitPath(path)) {
                DocumentFile next = cur.findFile(seg);
                if (next == null) return null;
                cur = next;
            }
            return cur;
        } catch (Exception e) {
            return null;
        }
    }

    private DocumentFile ensureFile(PluginCall call) throws Exception {
        String path = getPath(call);
        String mime = call.getString("mimeType");
        if (mime == null || mime.trim().isEmpty()) mime = "text/plain";

        String[] parts = splitPath(path);
        if (parts.length == 0) throw new Exception("Invalid path");

        DocumentFile cur = requireBase(call);
        for (int i = 0; i < parts.length - 1; i++) {
            DocumentFile next = cur.findFile(parts[i]);
            if (next == null) {
                next = cur.createDirectory(parts[i]);
                if (next == null) throw new Exception("Failed to create directory: " + parts[i]);
            }
            cur = next;
        }

        String fileName = parts[parts.length - 1];
        DocumentFile f = cur.findFile(fileName);
        if (f == null) {
            f = cur.createFile(mime, fileName);
            if (f == null) throw new Exception("Failed to create file: " + fileName);
        }
        return f;
    }

    private static String nonNull(String v, String msg) throws Exception {
        if (v == null) throw new Exception(msg);
        return v;
    }

    private static String[] splitPath(String p) {
        String[] raw = p.replace("\\", "/").split("/");
        ArrayList<String> parts = new ArrayList<>();
        for (String s : raw) {
            if (s != null && !s.isEmpty()) parts.add(s);
        }
        return parts.toArray(new String[0]);
    }
}
