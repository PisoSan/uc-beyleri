package com.ahmetkaragoz.ucbeyleri;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Zamanı gelen yerel alarmı bildirime çevirir; telefon açılınca alarmları geri kurar. */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        String a = i.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || "android.intent.action.MY_PACKAGE_REPLACED".equals(a)) { Notif.restore(c); return; }
        Notif.show(c, i.getStringExtra("k"), i.getStringExtra("title"), i.getStringExtra("body"), i.getStringExtra("ch"));
    }
}
