package com.ahmetkaragoz.ucbeyleri;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Bildirim yardımcıları.
 *  - "saldiri": başka oyuncunun saldırısı (yüksek öncelik, sesli)
 *  - "zaman":   inşaat / eğitim / ordu dönüşü / günlük sandık (normal)
 * Aynı "etiket" (tag) ile gelen bildirim öncekinin yerini alır; böylece
 * hem sunucudan (Firebase) hem telefondan (alarm) gelen aynı haber iki kez görünmez.
 */
final class Notif {
    static final String PREFS = "ub_notif";

    static void channels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        NotificationChannel a = new NotificationChannel("saldiri", "Saldırılar", NotificationManager.IMPORTANCE_HIGH);
        a.setDescription("Köyüne saldırı geldiğinde");
        NotificationChannel z = new NotificationChannel("zaman", "Zamanlayıcılar", NotificationManager.IMPORTANCE_DEFAULT);
        z.setDescription("İnşaat, eğitim, ordu dönüşü ve günlük sandık");
        NotificationChannel k = new NotificationChannel("klan", "Klan", NotificationManager.IMPORTANCE_DEFAULT);
        k.setDescription("Klan davetleri ve haberleri");
        nm.createNotificationChannel(a);
        nm.createNotificationChannel(z);
        nm.createNotificationChannel(k);
    }

    static void show(Context c, String tag, String title, String body, String ch) {
        if (MainActivity.visible) return;               // oyun açıkken oyun kendisi gösteriyor
        channels(c);
        if (ch == null || ch.isEmpty()) ch = "zaman";
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, ch) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_notif)
         .setContentTitle(title)
         .setContentText(body)
         .setStyle(new Notification.BigTextStyle().bigText(body))
         .setColor(0xFFDCAA45)
         .setAutoCancel(true)
         .setContentIntent(pi);
        if (Build.VERSION.SDK_INT < 26) b.setPriority("saldiri".equals(ch) ? Notification.PRIORITY_HIGH : Notification.PRIORITY_DEFAULT).setDefaults(Notification.DEFAULT_ALL);
        try { c.getSystemService(NotificationManager.class).notify(tag == null ? "ub" : tag, 1, b.build()); } catch (SecurityException ignored) {}
    }

    // ---------- yerel alarmlar (oyunun kendi zamanlayıcıları) ----------
    private static PendingIntent alarmIntent(Context c, String k, JSONObject o) {
        Intent i = new Intent(c, AlarmReceiver.class).setAction("ub.alarm." + k);
        if (o != null) {
            i.putExtra("k", k);
            i.putExtra("title", o.optString("title"));
            i.putExtra("body", o.optString("body"));
            i.putExtra("ch", o.optString("ch", "zaman"));
        }
        return PendingIntent.getBroadcast(c, k.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Önceki planı iptal edip yenisini kurar. json: [{k,t,title,body,ch}] */
    static void plan(Context c, String json, boolean remember) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        AlarmManager am = c.getSystemService(AlarmManager.class);
        try {
            JSONArray old = new JSONArray(p.getString("plan", "[]"));
            for (int i = 0; i < old.length(); i++) am.cancel(alarmIntent(c, old.getJSONObject(i).getString("k"), null));
        } catch (Exception ignored) {}
        JSONArray keep = new JSONArray();
        try {
            JSONArray a = new JSONArray(json == null ? "[]" : json);
            long now = System.currentTimeMillis();
            for (int i = 0; i < a.length() && i < 40; i++) {
                JSONObject o = a.getJSONObject(i);
                long t = o.getLong("t");
                if (t <= now) continue;
                String k = o.getString("k");
                PendingIntent pi = alarmIntent(c, k, o);
                if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
                else am.set(AlarmManager.RTC_WAKEUP, t, pi);
                keep.put(o);
            }
        } catch (Exception ignored) {}
        if (remember) p.edit().putString("plan", keep.toString()).apply();
    }

    /** Telefon yeniden başlayınca alarmları geri kurar. */
    static void restore(Context c) {
        plan(c, c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("plan", "[]"), true);
    }

    private Notif() {}
}
