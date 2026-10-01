package com.ahmetkaragoz.ucbeyleri;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Firebase'den gelen anlık bildirimler (başka oyuncunun saldırısı, klan daveti).
 * Sunucu yalnızca "data" mesajı yollar; bildirimi biz çizeriz ki etiketle tekilleştirebilelim.
 */
public class PushService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(RemoteMessage m) {
        Map<String, String> d = m.getData();
        String title = d.get("title"), body = d.get("body");
        if (title == null && m.getNotification() != null) { title = m.getNotification().getTitle(); body = m.getNotification().getBody(); }
        if (title == null) return;
        Notif.show(this, d.get("tag"), title, body == null ? "" : body, d.get("ch"));
    }

    @Override
    public void onNewToken(String token) {
        getSharedPreferences(Notif.PREFS, MODE_PRIVATE).edit().putString("token", token).apply();
    }
}
