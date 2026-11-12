package com.erickhc.sellodeobra;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.UUID;

/**
 * Guarda archivos generados por la app en el almacenamiento compartido del teléfono:
 *  - Fotos  -> Pictures/Sello de Obra   (aparecen en la Galería, álbum "Sello de Obra")
 *  - Otros  -> Download/Sello de Obra   (ZIP, CSV, KML)
 * Los datos llegan desde la página en partes (base64) para no agotar la memoria con archivos grandes.
 */
@CapacitorPlugin(
    name = "Galeria",
    permissions = {
        @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
    }
)
public class GaleriaPlugin extends Plugin {

    private static final String ALBUM = "Sello de Obra";

    private File tempFile(String id) {
        return new File(getContext().getCacheDir(), "sello_" + id.replaceAll("[^A-Za-z0-9_-]", "") + ".part");
    }

    /** Empieza un archivo nuevo. Devuelve {id}. */
    @PluginMethod
    public void begin(PluginCall call) {
        try {
            String id = UUID.randomUUID().toString();
            File f = tempFile(id);
            if (f.exists()) f.delete();
            if (!f.createNewFile()) throw new Exception("No se pudo crear el archivo temporal");
            JSObject r = new JSObject();
            r.put("id", id);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("No se pudo iniciar el guardado: " + e.getMessage());
        }
    }

    /** Agrega una parte (base64) al archivo. */
    @PluginMethod
    public void append(PluginCall call) {
        String id = call.getString("id");
        String data = call.getString("data");
        if (id == null || data == null) { call.reject("Faltan datos"); return; }
        File f = tempFile(id);
        if (!f.exists()) { call.reject("Guardado no iniciado"); return; }
        try (FileOutputStream out = new FileOutputStream(f, true)) {
            out.write(Base64.decode(data, Base64.DEFAULT));
            call.resolve();
        } catch (Exception e) {
            call.reject("No hay espacio suficiente en el teléfono: " + e.getMessage());
        }
    }

    /** Termina y publica el archivo en la Galería (fotos) o en Descargas (otros). */
    @PluginMethod
    public void finish(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storagePermsCallback");
            return;
        }
        doFinish(call);
    }

    @PermissionCallback
    private void storagePermsCallback(PluginCall call) {
        if (getPermissionState("storage") == PermissionState.GRANTED) doFinish(call);
        else {
            String id = call.getString("id");
            if (id != null) tempFile(id).delete();
            call.reject("Sin permiso para guardar archivos en el teléfono");
        }
    }

    private void doFinish(PluginCall call) {
        String id = call.getString("id");
        String name = call.getString("name", "foto.jpg");
        String mime = call.getString("mime", "image/jpeg");
        boolean photo = mime.startsWith("image/");
        if (id == null) { call.reject("Falta id"); return; }
        File src = tempFile(id);
        if (!src.exists()) { call.reject("Guardado no iniciado"); return; }
        name = name.replaceAll("[\\\\/:*?\"<>|]", "_");
        try {
            String where;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver cr = getContext().getContentResolver();
                ContentValues v = new ContentValues();
                Uri collection;
                if (photo) {
                    collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                    v.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                    v.put(MediaStore.Images.Media.MIME_TYPE, mime);
                    v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + ALBUM);
                    v.put(MediaStore.Images.Media.DATE_TAKEN, call.getLong("dateTaken", System.currentTimeMillis()));
                    v.put(MediaStore.Images.Media.IS_PENDING, 1);
                    where = Environment.DIRECTORY_PICTURES + "/" + ALBUM;
                } else {
                    collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                    v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                    v.put(MediaStore.Downloads.MIME_TYPE, mime);
                    v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + ALBUM);
                    v.put(MediaStore.Downloads.IS_PENDING, 1);
                    where = Environment.DIRECTORY_DOWNLOADS + "/" + ALBUM;
                }
                Uri uri = cr.insert(collection, v);
                if (uri == null) throw new Exception("El teléfono no aceptó el archivo");
                try (InputStream in = new FileInputStream(src); OutputStream out = cr.openOutputStream(uri)) {
                    if (out == null) throw new Exception("No se pudo escribir");
                    copy(in, out);
                } catch (Exception e) {
                    cr.delete(uri, null, null);
                    throw e;
                }
                ContentValues done = new ContentValues();
                done.put(MediaStore.MediaColumns.IS_PENDING, 0);
                cr.update(uri, done, null, null);
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(
                        photo ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS), ALBUM);
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("No se pudo crear la carpeta");
                File dest = new File(dir, name);
                String base = name.contains(".") ? name.substring(0, name.lastIndexOf('.')) : name;
                String ext = name.contains(".") ? name.substring(name.lastIndexOf('.')) : "";
                int k = 1;
                while (dest.exists()) { dest = new File(dir, base + " (" + (k++) + ")" + ext); }
                try (InputStream in = new FileInputStream(src); OutputStream out = new FileOutputStream(dest)) {
                    copy(in, out);
                }
                MediaScannerConnection.scanFile(getContext(), new String[] { dest.getAbsolutePath() }, new String[] { mime }, null);
                where = (photo ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS) + "/" + ALBUM;
            }
            JSObject r = new JSObject();
            r.put("folder", where);
            r.put("name", name);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("No se pudo guardar: " + e.getMessage());
        } finally {
            src.delete();
        }
    }

    /** Cancela un guardado a medias. */
    @PluginMethod
    public void abort(PluginCall call) {
        String id = call.getString("id");
        if (id != null) tempFile(id).delete();
        call.resolve();
    }

    /** Mantiene la pantalla encendida (exportaciones largas, cámara). */
    @PluginMethod
    public void keepAwake(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
        call.resolve();
    }

    private static void copy(InputStream in, OutputStream out) throws Exception {
        byte[] buf = new byte[256 * 1024];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        out.flush();
    }
}
